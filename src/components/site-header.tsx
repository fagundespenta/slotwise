import Link from "next/link";
import { auth } from "@/auth";
import { getI18n } from "@/i18n/server";
import { LocaleSwitcher } from "./client";
import { ButtonLink, Logo } from "./ui";

export async function SiteHeader() {
  const [{ locale, t }, session] = await Promise.all([getI18n(), auth()]);
  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="Slotwise home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher locale={locale} label={t.common.language} />
          {session?.user ? (
            <ButtonLink href="/dashboard">{t.common.dashboard}</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" className="hidden sm:inline-flex">
                {t.common.signIn}
              </ButtonLink>
              <ButtonLink href="/signup">{t.common.signUp}</ButtonLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
