"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { SubmitButton } from "@/components/client";
import { Alert, Button, Field, fieldProps, Input } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/time";
import { addBlockedDateAction, saveWeeklyRulesAction } from "@/server/actions/dashboard";

type Rule = { weekday: number; startMinute: number; endMinute: number };
type Range = { key: number; start: string; end: string };

let nextKey = 1;
const toRange = (r: Rule): Range => ({ key: nextKey++, start: minutesToHHMM(r.startMinute), end: minutesToHHMM(r.endMinute) });

// Display Monday first, as most businesses think of their week.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function WeeklyHoursEditor({ t, initial }: { t: Dictionary; initial: Rule[] }) {
  const [days, setDays] = useState<Record<number, Range[]>>(() => {
    const out: Record<number, Range[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const r of initial) out[r.weekday].push(toRange(r));
    return out;
  });
  const [status, setStatus] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();

  const update = (weekday: number, ranges: Range[]) => {
    setStatus(null);
    setDays((d) => ({ ...d, [weekday]: ranges }));
  };

  const save = () => {
    let rules: Rule[];
    try {
      rules = Object.entries(days).flatMap(([weekday, ranges]) =>
        ranges.map((r) => ({ weekday: Number(weekday), startMinute: hhmmToMinutes(r.start), endMinute: hhmmToMinutes(r.end) })),
      );
    } catch {
      setStatus({ error: t.availability.invalidRange });
      return;
    }
    if (rules.some((r) => r.endMinute <= r.startMinute)) {
      setStatus({ error: t.availability.invalidRange });
      return;
    }
    start(async () => {
      const res = await saveWeeklyRulesAction(rules);
      setStatus(res?.ok ? { ok: true } : { error: res?.error ?? t.common.somethingWrong });
    });
  };

  return (
    <div>
      <ul className="divide-y divide-border">
        {ORDER.map((weekday) => {
          const ranges = days[weekday];
          const dayName = t.availability.weekdays[weekday];
          return (
            <li key={weekday} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
              <div className="flex w-32 shrink-0 items-center gap-2 pt-2">
                <input
                  id={`day-${weekday}`}
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--brand)]"
                  checked={ranges.length > 0}
                  onChange={(e) =>
                    update(weekday, e.target.checked ? [toRange({ weekday, startMinute: 540, endMinute: 1080 })] : [])
                  }
                />
                <label htmlFor={`day-${weekday}`} className="text-sm font-medium">
                  {dayName}
                </label>
              </div>
              <div className="flex-1 space-y-2">
                {ranges.length === 0 ? <p className="pt-2 text-sm text-muted">{t.availability.closed}</p> : null}
                {ranges.map((r, i) => (
                  <div key={r.key} className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`s-${r.key}`}>{`${dayName} ${t.availability.from}`}</label>
                    <Input
                      id={`s-${r.key}`}
                      type="time"
                      step={900}
                      value={r.start}
                      onChange={(e) => update(weekday, ranges.map((x) => (x.key === r.key ? { ...x, start: e.target.value } : x)))}
                      className="w-32"
                    />
                    <span aria-hidden className="text-muted">–</span>
                    <label className="sr-only" htmlFor={`e-${r.key}`}>{`${dayName} ${t.availability.to}`}</label>
                    <Input
                      id={`e-${r.key}`}
                      type="time"
                      step={900}
                      value={r.end === "24:00" ? "23:59" : r.end}
                      onChange={(e) => update(weekday, ranges.map((x) => (x.key === r.key ? { ...x, end: e.target.value } : x)))}
                      className="w-32"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="px-2"
                      aria-label={`${t.availability.removeRange} ${i + 1} (${dayName})`}
                      onClick={() => update(weekday, ranges.filter((x) => x.key !== r.key))}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                {ranges.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs text-brand"
                    onClick={() => {
                      const last = ranges[ranges.length - 1];
                      const s = Math.min(hhmmToMinutes(last.end) + 60, 1380);
                      update(weekday, [...ranges, toRange({ weekday, startMinute: s, endMinute: Math.min(s + 120, 1440) })]);
                    }}
                  >
                    + {t.availability.addRange}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={pending} aria-busy={pending}>
          {pending ? t.common.saving : t.availability.saveHours}
        </Button>
        <div aria-live="polite" className="text-sm">
          {status?.ok ? <span className="text-success">✓ {t.common.saved}</span> : null}
        </div>
      </div>
      {status?.error ? (
        <div className="mt-3">
          <Alert>{status.error}</Alert>
        </div>
      ) : null}
    </div>
  );
}

export function BlockedDateForm({ t, min }: { t: Dictionary; min: string }) {
  const [state, action] = useActionState(addBlockedDateAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const f = state?.fields ?? {};
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end" noValidate>
      <Field id="date" label={t.availability.date} error={f.date}>
        <Input {...fieldProps("date", f.date)} type="date" min={min} required />
      </Field>
      <Field id="reason" label={`${t.availability.reason} (${t.common.optional})`} error={f.reason}>
        <Input {...fieldProps("reason", f.reason)} maxLength={120} />
      </Field>
      <SubmitButton variant="secondary">{t.availability.addBlocked}</SubmitButton>
    </form>
  );
}
