import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { PresenceProvider } from "@/context/PresenceContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "BWC Task Manager",
  description: "Task management system for BWC",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="max-w-full overflow-x-hidden">
      <body className="antialiased max-w-full overflow-x-hidden">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ErrorBoundary>
            <AuthProvider>
              <LanguageProvider>
                <PresenceProvider>
                  <NotificationProvider>
                    {children}
                  </NotificationProvider>
                </PresenceProvider>
              </LanguageProvider>
            </AuthProvider>
          </ErrorBoundary>
        </NextIntlClientProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
