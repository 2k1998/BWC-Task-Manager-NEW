import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const supportedLocales = ["en", "el"] as const;
type Locale = (typeof supportedLocales)[number];

const isLocale = (value: string): value is Locale =>
  (supportedLocales as readonly string[]).includes(value);

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value ?? "";
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : "en";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
