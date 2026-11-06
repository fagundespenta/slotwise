import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, googleEnabled } from "@/auth";
import { Card } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { SignupForm } from "../forms";
import { GoogleButton } from "../google-button";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if ((await auth())?.user) redirect("/dashboard");
  const { t } = await getI18n();
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.auth.signupTitle}</h1>
      <p className="mt-1 mb-6 text-sm text-muted">{t.auth.signupSubtitle}</p>
      {googleEnabled ? <GoogleButton label={t.auth.google} or={t.common.or} /> : null}
      <SignupForm t={t} />
    </Card>
  );
}
