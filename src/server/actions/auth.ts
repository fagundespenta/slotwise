"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { getDictionary, isLocale } from "@/i18n/dictionaries";
import { getI18n, LOCALE_COOKIE } from "@/i18n/server";
import { db } from "@/lib/db";
import { fieldErrors, onboardingSchema, signInSchema, signUpSchema } from "@/lib/validation";
import { createBusinessFor, requireUser } from "@/server/session";
import { redirect } from "next/navigation";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.auth.invalidCredentials };
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (err) {
    if (err instanceof AuthError) return { error: t.auth.invalidCredentials };
    throw err; // redirect
  }
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getI18n();
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { name, email, password, businessName, timezone } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return { fields: { email: t.auth.emailTaken } };

  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
  });
  await createBusinessFor(user.id, businessName, timezone);

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function onboardingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const existing = await db.business.findUnique({ where: { ownerId: user.id } });
  if (!existing) await createBusinessFor(user.id, parsed.data.businessName, parsed.data.timezone);
  redirect("/dashboard");
}

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return getDictionary(locale).common.language;
}
