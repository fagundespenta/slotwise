import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { appUrl, getStripe } from "@/lib/stripe";
import { requireBusiness } from "@/server/session";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { business } = await requireBusiness();
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.settings.title} />
      <Card className="max-w-2xl">
        <SettingsForm
          t={t}
          baseUrl={`${appUrl()}/b/`}
          stripeEnabled={getStripe() !== null}
          timeZones={Intl.supportedValuesOf("timeZone")}
          initial={{
            name: business.name,
            slug: business.slug,
            description: business.description ?? "",
            timezone: business.timezone,
            currency: business.currency,
            depositPercent: business.depositPercent,
            minNoticeMinutes: business.minNoticeMinutes,
            maxAdvanceDays: business.maxAdvanceDays,
          }}
        />
      </Card>
    </>
  );
}
