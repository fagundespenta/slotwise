"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, Button, Field, fieldProps, Input, Textarea } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { deleteServiceAction, saveServiceAction, toggleServiceAction } from "@/server/actions/dashboard";

type ServiceValues = { id: string; name: string; description: string; durationMin: number; price: string; active: boolean };

export function ServiceForm({ t, initial, onDone }: { t: Dictionary; initial?: ServiceValues; onDone?: () => void }) {
  const [state, action] = useActionState(saveServiceAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const f = state?.fields ?? {};
  const prefix = initial ? `svc-${initial.id}-` : "svc-new-";

  useEffect(() => {
    if (state?.ok) {
      if (!initial) formRef.current?.reset();
      onDone?.();
    }
  }, [state, initial, onDone]);

  const p = (name: string) => ({ ...fieldProps(prefix + name, f[name]), name });

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field id={prefix + "name"} label={t.services.name} error={f.name}>
        <Input {...p("name")} defaultValue={initial?.name} required />
      </Field>
      <Field id={prefix + "description"} label={`${t.services.description} (${t.common.optional})`} error={f.description}>
        <Textarea {...p("description")} defaultValue={initial?.description} rows={2} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id={prefix + "durationMin"} label={t.services.duration} error={f.durationMin}>
          <Input {...p("durationMin")} type="number" min={5} max={480} step={5} defaultValue={initial?.durationMin ?? 30} required />
        </Field>
        <Field id={prefix + "price"} label={t.services.price} error={f.price}>
          <Input {...p("price")} type="number" min={0} step="0.01" inputMode="decimal" defaultValue={initial?.price ?? ""} required />
        </Field>
      </div>
      <div className="flex gap-2">
        <SubmitButton pendingText={t.common.saving}>{initial ? t.common.save : t.common.add}</SubmitButton>
        {onDone ? (
          <Button type="button" variant="ghost" onClick={onDone}>
            {t.common.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ServiceRowActions({ t, service }: { t: Dictionary; service: ServiceValues }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <div className="w-full border-t border-border pt-4">
        <ServiceForm t={t} initial={service} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
        {t.common.edit}
      </Button>
      <Button
        variant="secondary"
        className="px-3 py-1.5 text-xs"
        disabled={pending}
        onClick={() => start(() => toggleServiceAction(service.id))}
      >
        {service.active ? t.services.hide : t.services.show}
      </Button>
      <Button
        variant="danger"
        className="px-3 py-1.5 text-xs"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t.services.confirmDelete)) return;
          start(async () => {
            const res = await deleteServiceAction(service.id);
            if (res.hidden) setNotice(t.services.deleteBlocked);
          });
        }}
      >
        {t.common.delete}
      </Button>
      {notice ? (
        <div className="w-full">
          <Alert tone="warning">{notice}</Alert>
        </div>
      ) : null}
    </div>
  );
}
