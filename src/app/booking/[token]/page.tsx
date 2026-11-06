import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmActionButton, LocaleSwitcher } from "@/components/client";
import { Alert, ButtonLink, Card, Logo } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { formatDuration, formatLongDate, formatMoney, formatTime } from "@/lib/format";
import { getStripe } from "@/lib/stripe";
import { customerCancelAction } from "@/server/actions/public";
import { confirmPaidBooking } from "@/server/booking";

export const metadata: Metadata = { title: "Your booking", robots: { index: false } };

async function loadBooking(token: string) {
  return db.booking.findUnique({ where: { manageToken: token }, include: { service: true, business: true } });
}

export default async function ManageBookingPage({ params, searchParams }: PageProps<"/booking/[token]">) {
  const { token } = await params;
  const { session_id } = await searchParams;
  let booking = await loadBooking(token);
  if (!booking) notFound();

  // Returning from Stripe Checkout: verify the session directly so the page is
  // correct even when the webhook hasn't arrived yet (or isn't set up locally).
  const stripe = getStripe();
  if (booking.status === "PENDING_PAYMENT" && typeof session_id === "string" && stripe) {
    const session = await stripe.checkout.sessions.retrieve(session_id).catch(() => null);
    if (session?.metadata?.bookingId === booking.id && session.payment_status === "paid") {
      await confirmPaidBooking(booking.id, session.id);
      booking = (await loadBooking(token))!;
    }
  }

  const { t, locale } = await getI18n();
  const { business, service } = booking;
  const tz = business.timezone;
  const money = (c: number) => formatMoney(c, business.currency, locale);
  const holdExpired = booking.status === "PENDING_PAYMENT" && (!booking.holdExpiresAt || booking.holdExpiresAt < new Date());
  const cancelled = booking.status === "CANCELLED" || holdExpired;
  const isPast = booking.startsAt < new Date();

  const title = cancelled ? t.manage.cancelledTitle : booking.status === "PENDING_PAYMENT" ? t.manage.pendingTitle : t.manage.confirmedTitle;
  const icon = cancelled ? "✕" : booking.status === "PENDING_PAYMENT" ? "…" : "✓";
  const iconTone = cancelled ? "bg-danger-soft text-danger" : booking.status === "PENDING_PAYMENT" ? "bg-warning-soft text-warning" : "bg-success-soft text-success";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label="Slotwise">
          <Logo />
        </Link>
        <LocaleSwitcher locale={locale} label={t.common.language} />
      </header>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pb-12">
        <Card className="p-6 sm:p-8">
          <div className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl font-semibold ${iconTone}`} aria-hidden>
            {icon}
          </div>
          <h1 className="mt-4 text-center text-2xl font-semibold tracking-tight">{title}</h1>
          {booking.status === "PENDING_PAYMENT" && !holdExpired ? (
            <p className="mt-2 text-center text-sm text-muted">{t.manage.pendingBody}</p>
          ) : null}

          <h2 className="sr-only">{t.manage.details}</h2>
          <dl className="mt-6 divide-y divide-border rounded-xl border border-border text-sm">
            <Row label={t.manage.with} value={business.name} />
            <Row label={t.manage.service} value={`${service.name} · ${formatDuration(service.durationMin)}`} />
            <Row
              label={t.manage.when}
              value={
                <>
                  <span className="block first-letter:uppercase">{formatLongDate(booking.startsAt, tz, locale)}</span>
                  {formatTime(booking.startsAt, tz, locale)} – {formatTime(booking.endsAt, tz, locale)}{" "}
                  <span className="text-muted">({tz.replaceAll("_", " ")})</span>
                </>
              }
            />
            <Row label={t.manage.total} value={money(booking.priceCents)} />
            {booking.depositPaid ? <Row label={t.manage.depositPaid} value={money(booking.depositCents)} /> : null}
          </dl>

          {!cancelled ? (
            <div className="mt-6 space-y-3">
              {booking.status === "CONFIRMED" ? (
                <ButtonLink href={`/api/bookings/${booking.manageToken}/ics`} variant="secondary" className="w-full" prefetch={false}>
                  {t.manage.addToCalendar}
                </ButtonLink>
              ) : null}
              {isPast ? (
                <Alert tone="warning">{t.manage.cannotCancelPast}</Alert>
              ) : (
                <ConfirmActionButton
                  action={customerCancelAction.bind(null, booking.manageToken)}
                  confirmText={t.manage.confirmCancel}
                  className="w-full"
                >
                  {t.manage.cancel}
                </ConfirmActionButton>
              )}
              <p className="text-center text-xs text-muted">{t.manage.keepLink}</p>
            </div>
          ) : null}

          <div className="mt-6 text-center">
            <Link href={`/b/${business.slug}`} className="text-sm font-medium text-brand hover:underline">
              {t.manage.bookAnother} →
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="col-span-2">{value}</dd>
    </div>
  );
}
