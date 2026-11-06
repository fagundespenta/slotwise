import { NextResponse, type NextRequest } from "next/server";
import { cancelBooking, confirmPaidBooking } from "@/server/booking";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe webhook (test mode). Locally:
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 */
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (bookingId && session.payment_status === "paid") await confirmPaidBooking(bookingId, session.id);
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      const booking = await db.booking.findUnique({ where: { id: bookingId } });
      if (booking?.status === "PENDING_PAYMENT") await cancelBooking({ id: booking.id, businessId: booking.businessId });
    }
  }

  return NextResponse.json({ received: true });
}
