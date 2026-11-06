import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/client";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { formatDateTime, formatIsoDate, formatMoney } from "@/lib/format";
import { appUrl } from "@/lib/stripe";
import { requireBusiness } from "@/server/session";
import { getDashboardStats } from "@/server/stats";

export const metadata: Metadata = { title: "Dashboard" };

export default async function OverviewPage() {
  const { business } = await requireBusiness();
  const { t, locale } = await getI18n();
  const [stats, serviceCount, ruleCount] = await Promise.all([
    getDashboardStats(business),
    db.service.count({ where: { businessId: business.id, active: true } }),
    db.availabilityRule.count({ where: { businessId: business.id } }),
  ]);
  const money = (c: number) => formatMoney(c, business.currency, locale);
  const link = `${appUrl()}/b/${business.slug}`;
  const max = Math.max(1, ...stats.weekly.map((w) => w.revenueCents));
  const showOnboarding = serviceCount === 0 || ruleCount === 0;

  const kpis = [
    { label: t.overview.upcoming, value: String(stats.upcomingCount) },
    { label: t.overview.revenueMonth, value: money(stats.monthRevenueCents) },
    { label: t.overview.bookingsMonth, value: String(stats.monthBookings) },
    { label: t.overview.cancellationRate, value: `${Math.round(stats.cancellationRate * 100)}%` },
  ];

  return (
    <>
      <PageHeader title={t.overview.title} subtitle={business.name} />

      {showOnboarding ? (
        <Card className="mb-6 border-brand/40">
          <h2 className="font-semibold">{t.overview.gettingStarted}</h2>
          <ol className="mt-3 space-y-2 text-sm">
            <Step done={serviceCount > 0} href="/dashboard/services" label={t.overview.stepServices} />
            <Step done={ruleCount > 0} href="/dashboard/availability" label={t.overview.stepHours} />
            <Step done={false} href={`/b/${business.slug}`} label={t.overview.stepShare} />
          </ol>
        </Card>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <dt className="text-xs font-medium text-muted">{k.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</dd>
          </Card>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <h2 className="font-semibold">{t.overview.weeklyRevenue}</h2>
          <figure className="mt-6">
            <div className="flex h-44 items-end gap-2" role="img" aria-label={t.overview.weeklyRevenue}>
              {stats.weekly.map((w) => (
                <div key={w.week} className="group flex h-full flex-1 flex-col justify-end">
                  <span className="mb-1 text-center text-[10px] text-muted opacity-0 tabular-nums transition-opacity group-hover:opacity-100">
                    {money(w.revenueCents)}
                  </span>
                  <div
                    className="rounded-t-md bg-brand/80 transition-colors group-hover:bg-brand"
                    style={{ height: `${Math.max(2, (w.revenueCents / max) * 100)}%` }}
                    title={`${formatIsoDate(w.week, locale, { weekday: undefined })}: ${money(w.revenueCents)} · ${w.count}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2 text-center text-[10px] text-muted">
              {stats.weekly.map((w) => (
                <span key={w.week} className="flex-1 truncate">
                  {formatIsoDate(w.week, locale, { weekday: undefined })}
                </span>
              ))}
            </div>
            <table className="sr-only">
              <tbody>
                {stats.weekly.map((w) => (
                  <tr key={w.week}>
                    <th>{w.week}</th>
                    <td>{money(w.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </figure>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="font-semibold">{t.overview.shareLink}</h2>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-muted px-3 py-2 text-sm">{link}</code>
            <CopyButton value={link} label={t.overview.copy} copiedLabel={t.overview.copied} />
          </div>
          <h2 className="mt-6 font-semibold">{t.overview.nextAppointments}</h2>
          {stats.next.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t.overview.noUpcoming}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {stats.next.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.customerName}</p>
                    <p className="truncate text-xs text-muted">
                      {b.service.name} · {formatDateTime(b.startsAt, business.timezone, locale)}
                    </p>
                  </div>
                  {b.status === "PENDING_PAYMENT" ? <Badge tone="warning">{t.bookings.statusPENDING_PAYMENT}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/bookings" className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
            {t.nav.bookings} →
          </Link>
        </Card>
      </div>
    </>
  );
}

function Step({ done, href, label }: { done: boolean; href: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${done ? "bg-success text-white" : "border border-border"}`}
      >
        {done ? "✓" : ""}
      </span>
      <Link href={href} className={done ? "text-muted line-through" : "font-medium hover:underline"}>
        {label}
      </Link>
    </li>
  );
}
