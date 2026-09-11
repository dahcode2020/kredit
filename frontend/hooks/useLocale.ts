"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Locale, defaultLocale, locales, getPersistedLocale, detectLocale } from "@/lib/i18n";

/**
 * Locale courante.
 *
 * ⚠️ Hydration-safe: le rendu serveur et le PREMIER rendu client doivent renvoyer la
 * même valeur. On ne lit donc ni `localStorage`, ni `document.cookie`, ni
 * `navigator.languages` pendant le render (le serveur renvoie `defaultLocale`, le
 * navigateur renvoie la préférence utilisateur → texte traduit différent → mismatch
 * sur toute la page).
 *
 * 1. le segment `[locale]` de l'URL fait foi (identique serveur/client),
 * 2. si absent, la préférence persistée est appliquée dans un effect (après hydratation).
 */
export function useLocale(): Locale {
  const params = useParams() as { locale?: string } | null;
  const fromParams = params?.locale;
  const valid = fromParams && (locales as readonly string[]).includes(fromParams) ? (fromParams as Locale) : null;

  const [detected, setDetected] = useState<Locale>(defaultLocale);
  useEffect(() => {
    if (valid) return;
    const persisted = getPersistedLocale();
    setDetected(persisted ?? detectLocale({ navigatorLanguages: typeof navigator !== "undefined" ? navigator.languages : undefined }));
  }, [valid]);

  return valid ?? detected;
}
