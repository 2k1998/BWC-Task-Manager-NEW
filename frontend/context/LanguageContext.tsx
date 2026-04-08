"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import type { ProfileMeResponse } from "@/lib/types";

type Language = "en" | "el";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const loadLanguage = async () => {
      if (!user) {
        setLanguageState("en");
        return;
      }
      try {
        const response = await apiClient.get<ProfileMeResponse>("/profile/me");
        const profileLanguage = response.data.language === "el" ? "el" : "en";
        const currentCookieLocale =
          document.cookie
            .split("; ")
            .find((entry) => entry.startsWith("NEXT_LOCALE="))
            ?.split("=")[1] ?? "";
        setLanguageState(profileLanguage);
        document.cookie = `NEXT_LOCALE=${profileLanguage};path=/;max-age=31536000`;
        if (currentCookieLocale !== profileLanguage) {
          router.refresh();
        }
      } catch {
        setLanguageState("en");
      }
    };

    void loadLanguage();
  }, [user, router]);

  const setLanguage = useCallback((lang: Language) => {
    void (async () => {
      await apiClient.put("/profile/me", { language: lang });
      document.cookie = `NEXT_LOCALE=${lang};path=/;max-age=31536000`;
      setLanguageState(lang);
      router.refresh();
    })();
  }, [router]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
