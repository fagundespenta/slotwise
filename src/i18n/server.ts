import "server-only";
import { cookies, headers } from "next/headers";
import { defaultLocale, getDictionary, isLocale, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "slotwise-locale";

/** Locale from the cookie, falling back to the browser's Accept-Language. */
export async function getLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = (await headers()).get("accept-language") ?? "";
  return accept.toLowerCase().startsWith("pt") ? "pt" : defaultLocale;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
