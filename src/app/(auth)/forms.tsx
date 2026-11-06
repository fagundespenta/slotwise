"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, Field, fieldProps, Input } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { onboardingAction, signInAction, signUpAction } from "@/server/actions/auth";

export function LoginForm({ t }: { t: Dictionary }) {
  const [state, action] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field id="email" label={t.auth.email}>
        <Input {...fieldProps("email")} type="email" autoComplete="email" required />
      </Field>
      <Field id="password" label={t.auth.password}>
        <Input {...fieldProps("password")} type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="…">
        {t.common.signIn}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link href="/signup" className="font-medium text-brand underline-offset-4 hover:underline">
          {t.common.signUp}
        </Link>
      </p>
    </form>
  );
}

/** The browser's timezone, so a new business starts with the right one. */
function useBrowserTimeZone() {
  const [tz, setTz] = useState("America/Sao_Paulo");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- only known after hydration
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);
  return tz;
}

export function SignupForm({ t }: { t: Dictionary }) {
  const [state, action] = useActionState(signUpAction, undefined);
  const tz = useBrowserTimeZone();
  const f = state?.fields ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field id="name" label={t.auth.name} error={f.name}>
        <Input {...fieldProps("name", f.name)} autoComplete="name" required />
      </Field>
      <Field id="businessName" label={t.auth.businessName} error={f.businessName}>
        <Input {...fieldProps("businessName", f.businessName)} autoComplete="organization" required />
      </Field>
      <Field id="email" label={t.auth.email} error={f.email}>
        <Input {...fieldProps("email", f.email)} type="email" autoComplete="email" required />
      </Field>
      <Field id="password" label={t.auth.password} error={f.password} hint={t.auth.passwordHint}>
        <Input {...fieldProps("password", f.password)} type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <input type="hidden" name="timezone" value={tz} />
      <SubmitButton className="w-full" pendingText="…">
        {t.common.signUp}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
          {t.common.signIn}
        </Link>
      </p>
    </form>
  );
}

export function OnboardingForm({ t, timeZones }: { t: Dictionary; timeZones: string[] }) {
  const [state, action] = useActionState(onboardingAction, undefined);
  const tz = useBrowserTimeZone();
  const f = state?.fields ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field id="businessName" label={t.auth.businessName} error={f.businessName}>
        <Input {...fieldProps("businessName", f.businessName)} required />
      </Field>
      <Field id="timezone" label={t.onboarding.timezone} error={f.timezone}>
        <Input {...fieldProps("timezone", f.timezone)} key={tz} defaultValue={tz} list="tz-list" required />
        <datalist id="tz-list">
          {timeZones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </Field>
      <SubmitButton className="w-full" pendingText="…">
        {t.onboarding.submit}
      </SubmitButton>
    </form>
  );
}
