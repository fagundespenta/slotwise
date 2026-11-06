import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;

/**
 * Returns a Stripe client, or `null` when deposits are disabled.
 * Slotwise is a portfolio project: only TEST keys are accepted, so a live key
 * pasted by mistake can never charge a real card.
 */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return (client = null);
  if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
    console.warn("[stripe] Ignoring STRIPE_SECRET_KEY: only test-mode keys are allowed.");
    return (client = null);
  }
  return (client = new Stripe(key));
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
