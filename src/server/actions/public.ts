"use server";

import { revalidatePath } from "next/cache";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { appUrl, getStripe } from "@/lib/stripe";
import { bookingRequestSchema, fieldErrors } from "@/lib/validation";
import { cancelBooking, createBooking } from "@/server/booking";

export type BookingActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error?: string; fields?: Record<string, string>; slotTaken?: boolean };

export async function createBookingAction(input: unknown): Promise<BookingActionResult> {
  const { t, locale } = await getI18n();
  const parsed = bookingRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fields: fieldErrors(parsed.error) };

  const stripe = getStripe();
  const result = await createBooking(parsed.data, { depositEnabled: stripe !== null });
  if (!result.ok) {
    return result.reason === "slot_taken"
      ? { ok: false, slotTaken: true, error: t.booking.slotTaken }
      : { ok: false, error: t.common.somethingWrong };
  }

  const managePath = `/booking/${result.manageToken}`;
  if (!result.needsPayment || !stripe) return { ok: true, redirectTo: managePath };

  const booking = await db.booking.findUniqueOrThrow({
    where: { id: result.bookingId },
    include: { service: true, business: true },
  });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking.customerEmail,
      locale: locale === "pt" ? "pt-BR" : "en",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: booking.business.currency,
            unit_amount: booking.depositCents,
            product_data: {
              name: `${booking.service.name} — deposit (${booking.business.depositPercent}%)`,
              description: booking.business.name,
            },
          },
        },
      ],
      metadata: { bookingId: booking.id },
      // Stripe's minimum session lifetime is 30 minutes, matching our slot hold.
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      success_url: `${appUrl()}${managePath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/b/${booking.business.slug}?payment=cancelled`,
    });
    await db.booking.update({ where: { id: booking.id }, data: { stripeSessionId: session.id } });
    return { ok: true, redirectTo: session.url! };
  } catch (err) {
    console.error("[stripe] checkout session failed", err);
    // Release the hold so the slot is not blocked by a failed payment attempt.
    await cancelBooking({ id: booking.id, businessId: booking.businessId });
    return { ok: false, error: t.common.somethingWrong };
  }
}

export async function customerCancelAction(manageToken: string) {
  const booking = await db.booking.findUnique({ where: { manageToken } });
  if (!booking || booking.startsAt < new Date()) return;
  await cancelBooking({ manageToken });
  revalidatePath(`/booking/${manageToken}`);
}
