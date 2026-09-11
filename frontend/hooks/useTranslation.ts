"use client";
import { useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Locale, locales, Namespace, tNs, t, setPersistedLocale } from "@/lib/i18n";
import { useLocale } from "./useLocale";

export function useTranslation(ns: Namespace) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const translate = useCallback((key: string, vars?: Record<string, any>) => tNs(locale, ns, key, vars), [locale, ns]);
  const setLocale = useCallback((next: Locale) => {
    setPersistedLocale(next);
    if (pathname) {
      const parts = pathname.split("/");
      if (locales.includes(parts[1] as Locale)) parts[1] = next;
      else parts.splice(1,0,next);
      router.push(parts.join("/") || `/${next}`);
    }
    fetch("/api/v1/customers/me/preferences", { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ locale: next }) }).catch(()=>{});
  }, [pathname, router]);
  return { t: translate, tRaw: t, locale, setLocale };
}
