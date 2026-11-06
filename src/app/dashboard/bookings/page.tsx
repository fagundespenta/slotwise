import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { ConfirmActionButton } from "@/components/client";
import { Badge, Card, cn, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ownerCancelBookingAction } from "@/server/actions/dashboard";
import { requireBusiness } from "@/server/session";

export const metadata: Metadata = { title: "Bookings" };

const filters = ["upcoming", "past", "cancelled"] as const;
type Filter = (typeof filters)[number];

export default async function BookingsPage({ searchParams }: PageProps<"/dashboard/bookings">) {
  const { business } = await requireBusiness();
  const { t, locale } = await getI18n();
  const raw = (await searchParams).filter;
  const filter: Filter = filters.includes(raw as Filter) ? (raw as Filter) : "upcoming";
  const now = new Date();

  const where: Record<Filter, Prisma.BookingWhereInput> = {
    upcoming: { status: { in: ["CONFIRMED", "PENDING_PAYMENT"] }, startsAt: { gte: now } },
    past: { status: "CONFIRMED", startsAt: { lt: now } },
    cancelled: { status: "CANCELLED" },
  };
  const bookings = await db.booking.findMany({
    where: { businessId: business.id, ...where[filter] },
    include: { service: true },
    orderBy: { startsAt: filter === "upcoming" ? "asc" : "desc" },
    take: 100,
  });

  const labels: Record<Filter, string> = {
    upcoming: t.bookings.filterUpcoming,
    past: t.bookings.filterPast,
    cancelled: t.bookings.filterCancelled,
  };
  const tone = { CONFIRMED: "success", PENDING_PAYMENT: "warning", CANCELLED: "danger" } as const;

  return (
    <>
      <PageHeader title={t.bookings.title} />
      <nav aria-label={t.bookings.title} className="mb-4 inline-flex rounded-lg border border-border bg-surface p-1">
        {filters.map((f) => (
          <Link
            key={f}
            href={`/dashboard/bookings?filter=${f}`}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              f === filter ? "bg-brand text-brand-contrast" : "text-muted hover:text-foreground",
            )}
          >
            {labels[f]}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden p-0">
        {bookings.length === 0 ? (
          <p className="p-6 text-sm text-muted">{t.bookings.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">{t.bookings.when}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t.bookings.customer}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t.bookings.service}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t.bookings.price}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t.bookings.status}</th>
                  <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">{t.bookings.actions}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((b) => (
                  <tr key={b.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatDateTime(b.startsAt, business.timezone, locale)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.customerName}</p>
                      <p className="text-xs text-muted">{b.customerEmail}{b.customerPhone ? ` · ${b.customerPhone}` : ""}</p>
                      {b.notes ? <p className="mt-1 max-w-xs text-xs text-muted italic">“{b.notes}”</p> : null}
                    </td>
                    <td className="px-4 py-3">{b.service.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {formatMoney(b.priceCents, business.currency, locale)}
                      {b.depositPaid ? <p className="text-xs text-success">{formatMoney(b.depositCents, business.currency, locale)} {t.bookings.depositPaid}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={tone[b.status]}>{t.bookings[`status${b.status}`]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.status !== "CANCELLED" && b.startsAt > now ? (
                        <ConfirmActionButton
                          action={ownerCancelBookingAction.bind(null, b.id)}
                          confirmText={t.bookings.confirmCancel}
                          className="px-3 py-1.5 text-xs"
                        >
                          {t.bookings.cancelBooking}
                        </ConfirmActionButton>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
