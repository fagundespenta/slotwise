import type { Metadata } from "next";
import { ConfirmActionButton } from "@/components/client";
import { Card, PageHeader } from "@/components/ui";
import { fmt } from "@/i18n/dictionaries";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { formatIsoDate } from "@/lib/format";
import { todayIn } from "@/lib/time";
import { removeBlockedDateAction } from "@/server/actions/dashboard";
import { requireBusiness } from "@/server/session";
import { BlockedDateForm, WeeklyHoursEditor } from "./editors";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const { business } = await requireBusiness();
  const { t, locale } = await getI18n();
  const today = todayIn(business.timezone);
  const [rules, blocked] = await Promise.all([
    db.availabilityRule.findMany({ where: { businessId: business.id }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    db.blockedDate.findMany({ where: { businessId: business.id, date: { gte: today } }, orderBy: { date: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title={t.availability.title} subtitle={fmt(t.availability.subtitle, { tz: business.timezone })} />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <WeeklyHoursEditor
            t={t}
            initial={rules.map((r) => ({ weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute }))}
          />
        </Card>
        <Card className="h-fit xl:col-span-2">
          <h2 className="font-semibold">{t.availability.blockedTitle}</h2>
          <p className="mt-1 text-sm text-muted">{t.availability.blockedSubtitle}</p>
          <BlockedDateForm t={t} min={today} />
          {blocked.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t.availability.noBlocked}</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {blocked.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{formatIsoDate(b.date, locale, { year: "numeric" })}</p>
                    {b.reason ? <p className="text-xs text-muted">{b.reason}</p> : null}
                  </div>
                  <ConfirmActionButton
                    action={removeBlockedDateAction.bind(null, b.id)}
                    confirmText={`${t.common.delete}?`}
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                  >
                    {t.common.delete}
                  </ConfirmActionButton>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
