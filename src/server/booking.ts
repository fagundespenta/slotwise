import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getAvailableSlots, type Interval, type Slot } from "@/lib/slots";
import { addDays, type IsoDate, todayIn, wallClock, weekdayOf } from "@/lib/time";
import type { BookingRequest } from "@/lib/validation";

// Slightly longer than the Stripe Checkout session (31 min) so a late payment always finds its hold.
const HOLD_MINUTES = 32;
const MAX_TX_RETRIES = 3;

type Tx = Prisma.TransactionClient;

export function newManageToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Bookings that currently occupy time: confirmed ones and unexpired payment holds. */
function blockingBookingsWhere(businessId: string, from: Date, to: Date, now: Date): Prisma.BookingWhereInput {
  return {
    businessId,
    startsAt: { lt: to },
    endsAt: { gt: from },
    OR: [{ status: "CONFIRMED" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
  };
}

async function loadBusy(client: Tx | typeof db, businessId: string, date: IsoDate, now: Date): Promise<Interval[]> {
  // A generous ±1 day window around the calendar date covers any timezone offset.
  const from = new Date(`${addDays(date, -1)}T00:00:00Z`);
  const to = new Date(`${addDays(date, 2)}T00:00:00Z`);
  return client.booking.findMany({
    where: blockingBookingsWhere(businessId, from, to, now),
    select: { startsAt: true, endsAt: true },
  }).then((rows) => rows.map((r) => ({ start: r.startsAt, end: r.endsAt })));
}

type BusinessForSlots = {
  id: string;
  timezone: string;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
};

function isWithinBookingHorizon(business: BusinessForSlots, date: IsoDate, now: Date): boolean {
  const today = todayIn(business.timezone, now);
  return date >= today && date <= addDays(today, business.maxAdvanceDays);
}

async function computeSlots(
  client: Tx | typeof db,
  business: BusinessForSlots,
  durationMin: number,
  date: IsoDate,
  now: Date,
): Promise<Slot[]> {
  if (!isWithinBookingHorizon(business, date, now)) return [];
  const [rules, blocked, busy] = await Promise.all([
    client.availabilityRule.findMany({ where: { businessId: business.id, weekday: weekdayOf(date) } }),
    client.blockedDate.findFirst({ where: { businessId: business.id, date } }),
    loadBusy(client, business.id, date, now),
  ]);
  if (blocked) return [];
  return getAvailableSlots({
    date,
    timeZone: business.timezone,
    rules,
    busy,
    durationMin,
    stepMin: durationMin <= 30 ? 15 : 30,
    now,
    minNoticeMin: business.minNoticeMinutes,
  });
}

export async function getPublicBusiness(slug: string) {
  return db.business.findUnique({
    where: { slug },
    include: {
      services: { where: { active: true }, orderBy: [{ priceCents: "asc" }, { name: "asc" }] },
    },
  });
}

export async function getSlotsFor(slug: string, serviceId: string, date: IsoDate, now = new Date()) {
  const business = await db.business.findUnique({ where: { slug } });
  if (!business) return null;
  const service = await db.service.findFirst({ where: { id: serviceId, businessId: business.id, active: true } });
  if (!service) return null;
  const slots = await computeSlots(db, business, service.durationMin, date, now);
  return { business, service, slots };
}

/** Next N calendar days with a flag telling whether the business opens that day at all. */
export async function getBookableDays(businessId: string, timeZone: string, maxAdvanceDays: number, now = new Date()) {
  const today = todayIn(timeZone, now);
  const days = Array.from({ length: Math.min(maxAdvanceDays, 60) + 1 }, (_, i) => addDays(today, i));
  const [rules, blocked] = await Promise.all([
    db.availabilityRule.findMany({ where: { businessId }, select: { weekday: true } }),
    db.blockedDate.findMany({ where: { businessId, date: { gte: today, lte: days[days.length - 1] } } }),
  ]);
  const openWeekdays = new Set(rules.map((r) => r.weekday));
  const blockedSet = new Set(blocked.map((b) => b.date));
  return days.map((date) => ({ date, open: openWeekdays.has(weekdayOf(date)) && !blockedSet.has(date) }));
}

export type CreateBookingResult =
  | { ok: true; bookingId: string; manageToken: string; needsPayment: boolean }
  | { ok: false; reason: "not_found" | "slot_taken" };

/**
 * Creates a booking without ever double-booking.
 *
 * The slot is re-validated *inside* a SERIALIZABLE transaction: if two
 * customers race for the same time, PostgreSQL aborts one transaction with a
 * serialization failure (P2034) and we retry it — at which point the slot is
 * no longer free and the second customer gets a friendly "slot taken" error.
 */
export async function createBooking(
  input: BookingRequest,
  opts: { depositEnabled: boolean; now?: Date },
): Promise<CreateBookingResult> {
  const now = opts.now ?? new Date();
  const start = new Date(input.start);

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const business = await tx.business.findUnique({ where: { slug: input.slug } });
          if (!business) return { ok: false, reason: "not_found" } as const;
          const service = await tx.service.findFirst({
            where: { id: input.serviceId, businessId: business.id, active: true },
          });
          if (!service) return { ok: false, reason: "not_found" } as const;

          const date = wallClock(start, business.timezone).date;
          const slots = await computeSlots(tx, business, service.durationMin, date, now);
          const slot = slots.find((s) => s.start.getTime() === start.getTime());
          if (!slot) return { ok: false, reason: "slot_taken" } as const;

          const depositCents =
            opts.depositEnabled && business.depositPercent > 0
              ? Math.round((service.priceCents * business.depositPercent) / 100)
              : 0;
          const needsPayment = depositCents > 0;

          const booking = await tx.booking.create({
            data: {
              businessId: business.id,
              serviceId: service.id,
              customerName: input.customerName,
              customerEmail: input.customerEmail,
              customerPhone: input.customerPhone,
              notes: input.notes,
              startsAt: slot.start,
              endsAt: slot.end,
              priceCents: service.priceCents,
              depositCents,
              status: needsPayment ? "PENDING_PAYMENT" : "CONFIRMED",
              holdExpiresAt: needsPayment ? new Date(now.getTime() + HOLD_MINUTES * 60_000) : null,
              manageToken: newManageToken(),
            },
          });
          return { ok: true, bookingId: booking.id, manageToken: booking.manageToken, needsPayment } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      const retryable = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!retryable || attempt >= MAX_TX_RETRIES) {
        if (retryable) return { ok: false, reason: "slot_taken" };
        throw err;
      }
    }
  }
}

export async function cancelBooking(where: { manageToken: string } | { id: string; businessId: string }) {
  const booking = await db.booking.findFirst({ where });
  if (!booking || booking.status === "CANCELLED") return booking;
  return db.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}

export async function confirmPaidBooking(bookingId: string, stripeSessionId: string) {
  return db.booking.updateMany({
    where: { id: bookingId, status: "PENDING_PAYMENT" },
    data: { status: "CONFIRMED", depositPaid: true, holdExpiresAt: null, stripeSessionId },
  });
}
