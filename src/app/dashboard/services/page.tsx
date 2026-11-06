import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { formatDuration, formatMoney } from "@/lib/format";
import { requireBusiness } from "@/server/session";
import { ServiceForm, ServiceRowActions } from "./service-form";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const { business } = await requireBusiness();
  const { t, locale } = await getI18n();
  const services = await db.service.findMany({
    where: { businessId: business.id },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  return (
    <>
      <PageHeader title={t.services.title} subtitle={t.services.subtitle} />
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-3 lg:col-span-3" aria-label={t.services.title}>
          {services.length === 0 ? <Card className="text-sm text-muted">{t.services.empty}</Card> : null}
          {services.map((s) => (
            <Card key={s.id} className={s.active ? "" : "opacity-70"}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 font-medium">
                    {s.name}
                    {s.active ? null : <Badge>{t.services.hidden}</Badge>}
                  </h2>
                  {s.description ? <p className="mt-0.5 text-sm text-muted">{s.description}</p> : null}
                  <p className="mt-2 text-sm tabular-nums">
                    {formatDuration(s.durationMin)} · <strong>{formatMoney(s.priceCents, business.currency, locale)}</strong>
                  </p>
                </div>
                <ServiceRowActions
                  t={t}
                  service={{ id: s.id, name: s.name, description: s.description ?? "", durationMin: s.durationMin, price: (s.priceCents / 100).toFixed(2), active: s.active }}
                />
              </div>
            </Card>
          ))}
        </section>
        <Card className="h-fit lg:col-span-2">
          <h2 className="mb-4 font-semibold">{t.services.addTitle}</h2>
          <ServiceForm t={t} />
        </Card>
      </div>
    </>
  );
}
