import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, googleEnabled } from "@/auth";
import { Card } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { LoginForm } from "../forms";
import { GoogleButton } from "../google-button";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if ((await auth())?.user) redirect("/dashboard");
  const { t } = await getI18n();
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t.auth.loginTitle}</h1>
      <p className="mt-1 mb-6 text-sm text-muted">{t.auth.loginSubtitle}</p>
      {googleEnabled ? <GoogleButton label={t.auth.google} or={t.common.or} /> : null}
      <LoginForm t={t} />
      <p className="mt-6 rounded-lg bg-surface-muted px-3 py-2 text-center text-xs text-muted">{t.auth.demoHint}</p>
    </Card>
  );
}
