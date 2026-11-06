import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";
import { OnboardingForm } from "../(auth)/forms";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await db.business.findUnique({ where: { ownerId: user.id } })) redirect("/dashboard");
  const { t } = await getI18n();
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex flex-1 justify-center px-4 py-12 sm:py-20">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{t.onboarding.title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted">{t.onboarding.subtitle}</p>
          <OnboardingForm t={t} timeZones={Intl.supportedValuesOf("timeZone")} />
        </Card>
      </main>
    </>
  );
}
