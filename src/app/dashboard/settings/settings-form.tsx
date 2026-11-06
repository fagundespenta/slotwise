"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, Field, fieldProps, Input, Select, Textarea } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { saveSettingsAction } from "@/server/actions/dashboard";

type Values = {
  name: string;
  slug: string;
  description: string;
  timezone: string;
  currency: string;
  depositPercent: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
};

export function SettingsForm({
  t,
  initial,
  baseUrl,
  stripeEnabled,
  timeZones,
}: {
  t: Dictionary;
  initial: Values;
  baseUrl: string;
  stripeEnabled: boolean;
  timeZones: string[];
}) {
  const [state, action] = useActionState(saveSettingsAction, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.ok ? <Alert tone="success">✓ {t.common.saved}</Alert> : null}
      <Field id="name" label={t.settings.name} error={f.name}>
        <Input {...fieldProps("name", f.name)} defaultValue={initial.name} required />
      </Field>
      <Field id="slug" label={t.settings.slug} error={f.slug}>
        <div className="flex items-stretch overflow-hidden rounded-lg border border-border focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
          <span className="hidden items-center bg-surface-muted px-3 text-sm text-muted sm:flex">{baseUrl}</span>
          <Input {...fieldProps("slug", f.slug)} defaultValue={initial.slug} className="rounded-none border-0 focus:ring-0" required />
        </div>
      </Field>
      <Field id="description" label={`${t.settings.description} (${t.common.optional})`} error={f.description}>
        <Textarea {...fieldProps("description", f.description)} defaultValue={initial.description} rows={3} maxLength={500} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="timezone" label={t.settings.timezone} error={f.timezone}>
          <Select {...fieldProps("timezone", f.timezone)} defaultValue={initial.timezone}>
            {timeZones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="currency" label={t.settings.currency} error={f.currency}>
          <Select {...fieldProps("currency", f.currency)} defaultValue={initial.currency}>
            <option value="usd">USD — US Dollar</option>
            <option value="brl">BRL — Real</option>
            <option value="eur">EUR — Euro</option>
          </Select>
        </Field>
        <Field id="minNoticeMinutes" label={t.settings.minNotice} error={f.minNoticeMinutes}>
          <Input {...fieldProps("minNoticeMinutes", f.minNoticeMinutes)} type="number" min={0} step={15} defaultValue={initial.minNoticeMinutes} />
        </Field>
        <Field id="maxAdvanceDays" label={t.settings.maxAdvance} error={f.maxAdvanceDays}>
          <Input {...fieldProps("maxAdvanceDays", f.maxAdvanceDays)} type="number" min={1} max={365} defaultValue={initial.maxAdvanceDays} />
        </Field>
      </div>
      <Field id="depositPercent" label={t.settings.deposit} error={f.depositPercent} hint={t.settings.depositHint}>
        <Input {...fieldProps("depositPercent", f.depositPercent)} type="number" min={0} max={100} defaultValue={initial.depositPercent} className="max-w-32" />
      </Field>
      {!stripeEnabled && initial.depositPercent > 0 ? <Alert tone="warning">{t.settings.stripeOff}</Alert> : null}
      <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
    </form>
  );
}
