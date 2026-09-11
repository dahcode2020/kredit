import { Locale } from "./i18n";
import { normalizeIntlSpaces } from "./intl";

/**
 * Point d'entrée UNIQUE du formatage utilisateur (montants, dates, pourcentages).
 *
 * - la locale Intl est toujours dérivée du segment [locale] (jamais `undefined` :
 *   la locale par défaut du runtime diffère entre Node et le navigateur),
 * - le fuseau horaire est forcé à Europe/Brussels (le serveur tourne souvent en UTC),
 * - l'espacement Intl est normalisé (lib/intl.ts) : sans ça, un écart U+202F / U+00A0
 *   entre le HTML du serveur et le rendu du navigateur casse l'hydratation.
 */

export const localeToIntl: Record<Locale, string> = {
  fr: "fr-BE",
  en: "en-BE",
  nl: "nl-BE",
  de: "de-BE",
};

export const timeZone = "Europe/Brussels";

// Dates
export function formatDate(date: Date | string, locale: Locale, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return normalizeIntlSpaces(new Intl.DateTimeFormat(localeToIntl[locale], { day: "2-digit", month: "2-digit", year: "numeric", timeZone, ...opts }).format(d));
}
export function formatDateTime(date: Date | string, locale: Locale) {
  const d = typeof date === "string" ? new Date(date) : date;
  return normalizeIntlSpaces(new Intl.DateTimeFormat(localeToIntl[locale], { dateStyle: "medium", timeStyle: "short", timeZone }).format(d));
}
export function formatDateLong(date: Date | string, locale: Locale) {
  const d = typeof date === "string" ? new Date(date) : date;
  return normalizeIntlSpaces(new Intl.DateTimeFormat(localeToIntl[locale], { dateStyle: "long", timeZone }).format(d));
}
export function formatRelative(date: Date | string, locale: Locale) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const days = Math.round(diff / 86400000);
  const rtf = () => new Intl.RelativeTimeFormat(localeToIntl[locale], { numeric: "auto" });
  // ⚠️ `Date.now()` n'est pas connu du serveur : à n'appeler qu'après hydratation
  // (composant monté) ou avec un `now` horodaté par le serveur.
  if (Math.abs(days) < 1) {
    const hours = Math.round(diff / 3600000);
    if (Math.abs(hours) < 1) return normalizeIntlSpaces(rtf().format(-Math.round(diff / 60000), "minute"));
    return normalizeIntlSpaces(rtf().format(-hours, "hour"));
  }
  return normalizeIntlSpaces(rtf().format(-days, "day"));
}

// Numbers
export function formatNumber(n: number, locale: Locale, opts?: Intl.NumberFormatOptions) {
  return normalizeIntlSpaces(new Intl.NumberFormat(localeToIntl[locale], opts).format(n));
}
export function formatCurrency(n: number, locale: Locale, currency: string = "EUR") {
  return normalizeIntlSpaces(new Intl.NumberFormat(localeToIntl[locale], { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n));
}
export function formatCurrency0(n: number, locale: Locale, currency: string = "EUR") {
  return normalizeIntlSpaces(new Intl.NumberFormat(localeToIntl[locale], { style: "currency", currency, maximumFractionDigits: 0 }).format(n));
}
export function formatPercent(n: number, locale: Locale, digits = 1) {
  // n = 0.384 => 38,4%
  return normalizeIntlSpaces(new Intl.NumberFormat(localeToIntl[locale], { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n));
}
export function formatList(items: string[], locale: Locale, type: "conjunction" | "disjunction" = "conjunction") {
  return normalizeIntlSpaces(new Intl.ListFormat(localeToIntl[locale], { style: "long", type }).format(items));
}

// Address BE: Rue de la Loi 100 bte 5, 1000 Bruxelles, Belgique
export type Address = { street: string; number: string; box?: string; postal: string; city: string; country?: string };
export function formatAddressBE(a: Address, locale: Locale) {
  const countryMap: Record<Locale, string> = { fr: "Belgique", en: "Belgium", nl: "België", de: "Belgien" };
  const boxPart = a.box ? (locale === "nl" ? ` bus ${a.box}` : locale === "de" ? ` Fach ${a.box}` : ` bte ${a.box}`) : "";
  const country = a.country ?? countryMap[locale];
  return `${a.street} ${a.number}${boxPart}, ${a.postal} ${a.city}, ${country}`;
}

// Phone BE
import { parsePhoneNumberFromString } from "libphonenumber-js";
export function formatPhoneBE(raw: string, locale: Locale = "fr") {
  try {
    const pn = parsePhoneNumberFromString(raw, "BE");
    if (!pn || !pn.isValid()) return raw;
    return pn.formatInternational(); // +32 470 12 34 56
  } catch { return raw; }
}
export function isValidPhoneBE(raw: string) {
  const pn = parsePhoneNumberFromString(raw, "BE");
  return !!pn?.isValid();
}
export function formatPhoneNational(raw: string) {
  const pn = parsePhoneNumberFromString(raw, "BE");
  return pn?.formatNational() ?? raw; // 0470 12 34 56
}
