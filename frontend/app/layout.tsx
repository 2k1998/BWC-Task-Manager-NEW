import type { Metadata } from "next";
import { Toaster } from "sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import IntlProvider from "@/components/IntlProvider";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { PresenceProvider } from "@/context/PresenceContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "BWC Task Manager",
  description: "Task management system for BWC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="max-w-full overflow-x-hidden">
      <body className="antialiased max-w-full overflow-x-hidden">
        <IntlProvider>
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
        </IntlProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
