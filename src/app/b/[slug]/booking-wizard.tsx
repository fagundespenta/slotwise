"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, Button, Card, cn, Field, fieldProps, Input, Textarea } from "@/components/ui";
import { fmt, type Dictionary, type Locale } from "@/i18n/dictionaries";
import { formatDuration, formatIsoDate, formatLongDate, formatMoney, formatTime } from "@/lib/format";
import { createBookingAction } from "@/server/actions/public";

type Service = { id: string; name: string; description: string | null; durationMin: number; priceCents: number };
type Day = { date: string; open: boolean };
type Slot = { start: string; end: string };

export function BookingWizard({
  t,
  locale,
  business,
  services,
  days,
}: {
  t: Dictionary;
  locale: Locale;
  business: { slug: string; timezone: string; currency: string; depositPercent: number };
  services: Service[];
  days: Day[];
}) {
  const [service, setService] = useState<Service | null>(services.length === 1 ? services[0] : null);
  const [date, setDate] = useState<string | null>(() => days.find((d) => d.open)?.date ?? null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [submitting, startSubmit] = useTransition();
  const detailsRef = useRef<HTMLHeadingElement>(null);

  const money = (c: number) => formatMoney(c, business.currency, locale);
  const deposit = service ? Math.round((service.priceCents * business.depositPercent) / 100) : 0;

  // Load slots whenever service or date changes.
  useEffect(() => {
    if (!service || !date) return;
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ slug: business.slug, serviceId: service.id, date });
    fetch(`/api/slots?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { slots: Slot[] }) => setSlots(data.slots))
      .catch((e) => {
        if (e?.name !== "AbortError") setSlots([]);
      });
    return () => ctrl.abort();
  }, [service, date, business.slug, reloadKey]);

  useEffect(() => {
    if (slot) detailsRef.current?.focus();
  }, [slot]);

  const chooseService = (s: Service) => {
    setService(s);
    setSlot(null);
    setSlots(null);
  };
  const chooseDate = (d: string) => {
    setDate(d);
    setSlot(null);
    setSlots(null);
  };

  const submit = (formData: FormData) => {
    if (!service || !slot) return;
    setError(null);
    setFields({});
    startSubmit(async () => {
      const res = await createBookingAction({
        slug: business.slug,
        serviceId: service.id,
        start: slot.start,
        customerName: formData.get("customerName"),
        customerEmail: formData.get("customerEmail"),
        customerPhone: formData.get("customerPhone") || undefined,
        notes: formData.get("notes") || undefined,
      });
      if (res.ok) {
        window.location.assign(res.redirectTo);
        return;
      }
      if (res.slotTaken) {
        setSlot(null);
        setSlots(null);
        setReloadKey((k) => k + 1);
      }
      setError(res.error ?? null);
      setFields(res.fields ?? {});
    });
  };

  return (
    <div className="space-y-8">
      {/* Step 1 — service */}
      <section aria-labelledby="step-service">
        <StepTitle id="step-service" n={1} title={t.booking.pickService} />
        <div role="radiogroup" aria-labelledby="step-service" className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const selected = service?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseService(s)}
                className={cn(
                  "rounded-xl border bg-surface p-4 text-left transition-colors",
                  selected ? "border-brand ring-2 ring-brand/30" : "border-border hover:border-brand/50",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-medium">{s.name}</span>
                  <span className="font-semibold tabular-nums">{money(s.priceCents)}</span>
                </span>
                {s.description ? <span className="mt-1 block text-sm text-muted">{s.description}</span> : null}
                <span className="mt-2 block text-xs text-muted">{formatDuration(s.durationMin)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2 — date & time */}
      {service ? (
        <section aria-labelledby="step-date">
          <StepTitle id="step-date" n={2} title={t.booking.pickDate} />
          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <div role="radiogroup" aria-labelledby="step-date" className="flex gap-2">
              {days.map((d) => {
                const selected = d.date === date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!d.open}
                    aria-label={`${formatIsoDate(d.date, locale, { weekday: "long", month: "long" })}${d.open ? "" : ` — ${t.booking.closedDay}`}`}
                    onClick={() => chooseDate(d.date)}
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 text-sm transition-colors",
                      selected
                        ? "border-brand bg-brand text-brand-contrast"
                        : d.open
                          ? "border-border bg-surface hover:border-brand/50"
                          : "cursor-not-allowed border-transparent text-muted/60 line-through",
                    )}
                  >
                    <span className="text-xs capitalize">{formatIsoDate(d.date, locale, { day: undefined, month: undefined })}</span>
                    <span className="text-lg font-semibold tabular-nums">{Number(d.date.slice(8))}</span>
                    <span className="text-[10px] capitalize opacity-80">{formatIsoDate(d.date, locale, { weekday: undefined, day: undefined })}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {date ? (
            <div className="mt-5">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium">{t.booking.pickTime}</h3>
                <p className="text-xs text-muted">{fmt(t.booking.timesIn, { tz: business.timezone.replaceAll("_", " ") })}</p>
              </div>
              <div aria-live="polite" aria-busy={slots === null}>
                {slots === null ? (
                  <p className="text-sm text-muted">{t.booking.loading}</p>
                ) : slots.length === 0 ? (
                  <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted">{t.booking.noSlots}</p>
                ) : (
                  <div role="radiogroup" aria-label={t.booking.pickTime} className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {slots.map((s) => {
                      const selected = slot?.start === s.start;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setSlot(s)}
                          className={cn(
                            "rounded-lg border py-2 text-sm tabular-nums transition-colors",
                            selected ? "border-brand bg-brand-soft font-semibold text-brand-strong" : "border-border bg-surface hover:border-brand/50",
                          )}
                        >
                          {formatTime(new Date(s.start), business.timezone, locale)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {error && !slot ? <Alert>{error}</Alert> : null}

      {/* Step 3 — details */}
      {service && slot ? (
        <section aria-labelledby="step-details">
          <h2 id="step-details" ref={detailsRef} tabIndex={-1} className="mb-4 flex items-center gap-3 text-lg font-semibold focus:outline-none">
            <StepNumber n={3} />
            {t.booking.yourDetails}
          </h2>
          <div className="grid gap-6 md:grid-cols-5">
            <form action={submit} className="space-y-4 md:col-span-3" noValidate>
              {error ? <Alert>{error}</Alert> : null}
              <Field id="customerName" label={t.booking.name} error={fields.customerName}>
                <Input {...fieldProps("customerName", fields.customerName)} autoComplete="name" required />
              </Field>
              <Field id="customerEmail" label={t.booking.email} error={fields.customerEmail}>
                <Input {...fieldProps("customerEmail", fields.customerEmail)} type="email" autoComplete="email" required />
              </Field>
              <Field id="customerPhone" label={`${t.booking.phone} (${t.common.optional})`} error={fields.customerPhone}>
                <Input {...fieldProps("customerPhone", fields.customerPhone)} type="tel" autoComplete="tel" />
              </Field>
              <Field id="notes" label={`${t.booking.notes} (${t.common.optional})`} error={fields.notes}>
                <Textarea {...fieldProps("notes", fields.notes)} rows={3} maxLength={500} />
              </Field>
              <Button type="submit" className="w-full py-3 text-base" disabled={submitting} aria-busy={submitting}>
                {submitting ? "…" : deposit > 0 ? `${t.booking.confirmAndPay} · ${money(deposit)}` : t.booking.confirm}
              </Button>
            </form>
            <Card className="h-fit md:col-span-2">
              <h3 className="text-sm font-medium text-muted">{t.booking.summary}</h3>
              <p className="mt-2 font-semibold">{service.name}</p>
              <p className="text-sm text-muted">{formatDuration(service.durationMin)}</p>
              <p className="mt-3 text-sm first-letter:uppercase">{formatLongDate(new Date(slot.start), business.timezone, locale)}</p>
              <p className="text-sm font-medium tabular-nums">
                {formatTime(new Date(slot.start), business.timezone, locale)} – {formatTime(new Date(slot.end), business.timezone, locale)}
              </p>
              <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t.manage.total}</dt>
                  <dd className="tabular-nums">{money(service.priceCents)}</dd>
                </div>
                {deposit > 0 ? (
                  <div className="flex justify-between font-semibold">
                    <dt>{t.booking.deposit}</dt>
                    <dd className="tabular-nums">{money(deposit)}</dd>
                  </div>
                ) : null}
              </dl>
              <Button type="button" variant="ghost" className="mt-3 px-0 text-sm text-brand" onClick={() => setSlot(null)}>
                ← {t.booking.change}
              </Button>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-contrast">
      {n}
    </span>
  );
}

function StepTitle({ id, n, title }: { id: string; n: number; title: string }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-3 text-lg font-semibold">
      <StepNumber n={n} />
      {title}
    </h2>
  );
}
