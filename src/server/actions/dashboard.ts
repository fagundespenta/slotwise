"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import {
  blockedDateSchema,
  businessSchema,
  fieldErrors,
  serviceSchema,
  weeklyRulesSchema,
} from "@/lib/validation";
import { cancelBooking } from "@/server/booking";
import { requireBusiness } from "@/server/session";
import type { FormState } from "./auth";

export type ActionState = (FormState & { ok?: boolean }) | undefined;

// ---- Services -------------------------------------------------------------

export async function saveServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const { t } = await getI18n();
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.errors) };
  const { name, description, durationMin, price } = parsed.data;
  const id = formData.get("id");

  if (typeof id === "string" && id) {
    await db.service.updateMany({
      where: { id, businessId: business.id },
      data: { name, description, durationMin, priceCents: price },
    });
  } else {
    await db.service.create({
      data: { businessId: business.id, name, description, durationMin, priceCents: price },
    });
  }
  revalidatePath("/dashboard/services");
  return { ok: true };
}

export async function toggleServiceAction(id: string) {
  const { business } = await requireBusiness();
  const service = await db.service.findFirst({ where: { id, businessId: business.id } });
  if (!service) return;
  await db.service.update({ where: { id }, data: { active: !service.active } });
  revalidatePath("/dashboard/services");
}

export async function deleteServiceAction(id: string): Promise<{ hidden?: boolean }> {
  const { business } = await requireBusiness();
  const service = await db.service.findFirst({ where: { id, businessId: business.id }, include: { _count: { select: { bookings: true } } } });
  if (!service) return {};
  if (service._count.bookings > 0) {
    // Keep history intact: bookings reference the service.
    await db.service.update({ where: { id }, data: { active: false } });
    revalidatePath("/dashboard/services");
    return { hidden: true };
  }
  await db.service.delete({ where: { id } });
  revalidatePath("/dashboard/services");
  return {};
}

// ---- Availability ---------------------------------------------------------

export async function saveWeeklyRulesAction(rules: unknown): Promise<ActionState> {
  const { business } = await requireBusiness();
  const { t } = await getI18n();
  const parsed = weeklyRulesSchema.safeParse(rules);
  if (!parsed.success) return { error: t.availability.invalidRange };
  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { businessId: business.id } }),
    db.availabilityRule.createMany({ data: parsed.data.map((r) => ({ ...r, businessId: business.id })) }),
  ]);
  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export async function addBlockedDateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const { t } = await getI18n();
  const parsed = blockedDateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.errors) };
  await db.blockedDate.upsert({
    where: { businessId_date: { businessId: business.id, date: parsed.data.date } },
    update: { reason: parsed.data.reason },
    create: { businessId: business.id, ...parsed.data },
  });
  revalidatePath("/dashboard/availability");
  return { ok: true };
}

export async function removeBlockedDateAction(id: string) {
  const { business } = await requireBusiness();
  await db.blockedDate.deleteMany({ where: { id, businessId: business.id } });
  revalidatePath("/dashboard/availability");
}

// ---- Settings -------------------------------------------------------------

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { business } = await requireBusiness();
  const { t } = await getI18n();
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error, t.errors) };
  const taken = await db.business.findFirst({ where: { slug: parsed.data.slug, NOT: { id: business.id } } });
  if (taken) return { fields: { slug: t.settings.slugTaken } };
  await db.business.update({ where: { id: business.id }, data: parsed.data });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// ---- Bookings -------------------------------------------------------------

export async function ownerCancelBookingAction(id: string) {
  const { business } = await requireBusiness();
  await cancelBooking({ id, businessId: business.id });
  revalidatePath("/dashboard", "layout");
}
