import Link from "next/link";
import { LocaleSwitcher } from "@/components/client";
import { Button, Logo } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { signOutAction } from "@/server/actions/auth";
import { requireBusiness } from "@/server/session";
import { DashboardNav } from "./nav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const [{ business, user }, { locale, t }] = await Promise.all([requireBusiness(), getI18n()]);
  const items = [
    { href: "/dashboard", label: t.nav.overview },
    { href: "/dashboard/bookings", label: t.nav.bookings },
    { href: "/dashboard/services", label: t.nav.services },
    { href: "/dashboard/availability", label: t.nav.availability },
    { href: "/dashboard/settings", label: t.nav.settings },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
      <aside className="border-b border-border bg-surface px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-r md:border-b-0 md:py-6">
        <div className="flex items-center justify-between md:flex-col md:items-stretch md:gap-6">
          <Link href="/dashboard" aria-label="Slotwise dashboard">
            <Logo />
          </Link>
          <div className="hidden md:block">
            <p className="truncate text-sm font-semibold">{business.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <form action={signOutAction} className="md:hidden">
            <Button type="submit" variant="ghost" className="px-2">
              {t.common.signOut}
            </Button>
          </form>
        </div>
        <div className="mt-4 md:mt-6">
          <DashboardNav items={items} label={t.nav.menu} />
        </div>
        <div className="mt-6 hidden space-y-2 md:block">
          <Link
            href={`/b/${business.slug}`}
            target="_blank"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand hover:bg-surface-muted"
          >
            {t.nav.viewPage} ↗
          </Link>
          <LocaleSwitcher locale={locale} label={t.common.language} className="px-3" />
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" className="w-full justify-start px-3 text-muted">
              {t.common.signOut}
            </Button>
          </form>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}
