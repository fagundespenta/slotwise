import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocaleSwitcher } from "@/components/client";
import { Alert, Logo } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { getBookableDays, getPublicBusiness } from "@/server/booking";
import { getStripe } from "@/lib/stripe";
import { BookingWizard } from "./booking-wizard";

export async function generateMetadata({ params }: PageProps<"/b/[slug]">): Promise<Metadata> {
  const business = await getPublicBusiness((await params).slug);
  return business ? { title: business.name, description: business.description ?? undefined } : {};
}

export default async function PublicBookingPage({ params, searchParams }: PageProps<"/b/[slug]">) {
  const { slug } = await params;
  const { payment } = await searchParams;
  const business = await getPublicBusiness(slug);
  if (!business) notFound();
  const { t, locale } = await getI18n();
  const days = await getBookableDays(business.id, business.timezone, business.maxAdvanceDays);
  const depositPercent = getStripe() ? business.depositPercent : 0;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-6">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{business.name}</h1>
            {business.description ? <p className="mt-1 text-sm text-muted">{business.description}</p> : null}
          </div>
          <LocaleSwitcher locale={locale} label={t.common.language} />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {payment === "cancelled" ? (
          <div className="mb-6">
            <Alert tone="warning">{t.booking.paymentCancelled}</Alert>
          </div>
        ) : null}
        {business.services.length === 0 ? (
          <p className="text-muted">{t.booking.noServices}</p>
        ) : (
          <BookingWizard
            t={t}
            locale={locale}
            business={{ slug: business.slug, timezone: business.timezone, currency: business.currency, depositPercent }}
            services={business.services.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              durationMin: s.durationMin,
              priceCents: s.priceCents,
            }))}
            days={days}
          />
        )}
      </main>
      <footer className="py-6 text-center text-xs text-muted">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground">
          {t.booking.poweredBy.replace("Slotwise", "")}
          <Logo className="text-xs [&_svg]:h-4 [&_svg]:w-4" />
        </Link>
      </footer>
    </div>
  );
}
