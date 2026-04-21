import { getRequestConfig } from "next-intl/server";

// Static export: no request context at build time.
// Locale detection happens client-side in components/IntlProvider.tsx.
export default getRequestConfig(async () => {
  return {
    locale: "en",
    messages: (await import("./messages/en.json")).default,
  };
});
