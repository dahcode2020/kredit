"use client";
import { useParams } from "next/navigation";
import { Locale, defaultLocale } from "@/lib/i18n";
export function useLocale(): Locale {
  const params = useParams() as { locale?: string };
  return (params?.locale as Locale) || defaultLocale;
}
