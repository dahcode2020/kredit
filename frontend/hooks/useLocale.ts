"use client";
import { useParams } from "next/navigation";
import { Locale, defaultLocale, locales, getPersistedLocale, detectLocale } from "@/lib/i18n";

export function useLocale(): Locale {
  const params = useParams() as { locale?: string } | null;
  const fromParams = params?.locale;
  if (fromParams && (locales as readonly string[]).includes(fromParams)) return fromParams as Locale;
  const persisted = getPersistedLocale();
  if (persisted) return persisted;
  if (typeof navigator !== "undefined") {
    return detectLocale({ navigatorLanguages: navigator.languages });
  }
  return defaultLocale;
}
