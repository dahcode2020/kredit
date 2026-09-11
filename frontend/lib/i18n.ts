// KREDIT i18n — hiérarchie 1) préférence utilisateur 2) navigateur 3) défaut + persistance + ICU + fr-BE override
// Structure: frontend/i18n/{fr,en,nl,de}/*.json (11 namespaces) + fr-BE override
import frCommon from "@/i18n/fr/common.json";
import enCommon from "@/i18n/en/common.json";
import nlCommon from "@/i18n/nl/common.json";
import deCommon from "@/i18n/de/common.json";
import frAuth from "@/i18n/fr/auth.json";
import enAuth from "@/i18n/en/auth.json";
import nlAuth from "@/i18n/nl/auth.json";
import deAuth from "@/i18n/de/auth.json";
import frDashboard from "@/i18n/fr/dashboard.json";
import enDashboard from "@/i18n/en/dashboard.json";
import nlDashboard from "@/i18n/nl/dashboard.json";
import deDashboard from "@/i18n/de/dashboard.json";
import frCredit from "@/i18n/fr/credit.json";
import enCredit from "@/i18n/en/credit.json";
import nlCredit from "@/i18n/nl/credit.json";
import deCredit from "@/i18n/de/credit.json";
import frInvestment from "@/i18n/fr/investment.json";
import enInvestment from "@/i18n/en/investment.json";
import nlInvestment from "@/i18n/nl/investment.json";
import deInvestment from "@/i18n/de/investment.json";
import frPayments from "@/i18n/fr/payments.json";
import enPayments from "@/i18n/en/payments.json";
import nlPayments from "@/i18n/nl/payments.json";
import dePayments from "@/i18n/de/payments.json";
import frDocuments from "@/i18n/fr/documents.json";
import enDocuments from "@/i18n/en/documents.json";
import nlDocuments from "@/i18n/nl/documents.json";
import deDocuments from "@/i18n/de/documents.json";
import frNotifications from "@/i18n/fr/notifications.json";
import enNotifications from "@/i18n/en/notifications.json";
import nlNotifications from "@/i18n/nl/notifications.json";
import deNotifications from "@/i18n/de/notifications.json";
import frAdmin from "@/i18n/fr/admin.json";
import enAdmin from "@/i18n/en/admin.json";
import nlAdmin from "@/i18n/nl/admin.json";
import deAdmin from "@/i18n/de/admin.json";
import frErrors from "@/i18n/fr/errors.json";
import enErrors from "@/i18n/en/errors.json";
import nlErrors from "@/i18n/nl/errors.json";
import deErrors from "@/i18n/de/errors.json";
import frLegal from "@/i18n/fr/legal.json";
import enLegal from "@/i18n/en/legal.json";
import nlLegal from "@/i18n/nl/legal.json";
import deLegal from "@/i18n/de/legal.json";
import frBEOverride from "@/i18n/fr/fr-BE.json";

// Legacy flat (hero etc.) — kept for compat, merged as namespace "common" fallback
import {
  supportedLocales,
  defaultLocale as sharedDefaultLocale,
  parseAcceptLanguage as sharedParseAcceptLanguage,
  detectLocale as sharedDetectLocale,
  cookieFromHeader,
  isSupportedLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  LOCALE_COOKIE_MAX_AGE,
  localeCookieAttrs,
  type SupportedLocale,
} from "./locale-detection";

import frLegacy from "@/i18n/fr.json";
import enLegacy from "@/i18n/en.json";
import nlLegacy from "@/i18n/nl.json";
import deLegacy from "@/i18n/de.json";

// Sources uniques: locales / défaut / cookie / storage viennent de lib/locale-detection,
// utilisé aussi par middleware.ts et les hooks. Deux listes qui divergent = deux locales
// choisies (serveur vs client) = mismatch d'hydratation sur toute la page.
export const locales = supportedLocales;
export type Locale = SupportedLocale;
export const defaultLocale: Locale = sharedDefaultLocale;

export const namespaces = ["common","auth","dashboard","credit","investment","payments","documents","notifications","admin","errors","legal"] as const;
export type Namespace = typeof namespaces[number];

type Dict = Record<string, string>;

// Build per-locale per-namespace dicts
const raw: Record<Locale, Record<Namespace, Dict>> = {
  fr: {
    common: { ...frLegacy as Dict, ...frCommon as Dict, ...frBEOverride as Dict },
    auth: frAuth as Dict,
    dashboard: frDashboard as Dict,
    credit: frCredit as Dict,
    investment: frInvestment as Dict,
    payments: frPayments as Dict,
    documents: frDocuments as Dict,
    notifications: frNotifications as Dict,
    admin: frAdmin as Dict,
    errors: frErrors as Dict,
    legal: frLegal as Dict,
  },
  en: {
    common: { ...enLegacy as Dict, ...enCommon as Dict },
    auth: enAuth as Dict,
    dashboard: enDashboard as Dict,
    credit: enCredit as Dict,
    investment: enInvestment as Dict,
    payments: enPayments as Dict,
    documents: enDocuments as Dict,
    notifications: enNotifications as Dict,
    admin: enAdmin as Dict,
    errors: enErrors as Dict,
    legal: enLegal as Dict,
  },
  nl: {
    common: { ...nlLegacy as Dict, ...nlCommon as Dict },
    auth: nlAuth as Dict,
    dashboard: nlDashboard as Dict,
    credit: nlCredit as Dict,
    investment: nlInvestment as Dict,
    payments: nlPayments as Dict,
    documents: nlDocuments as Dict,
    notifications: nlNotifications as Dict,
    admin: nlAdmin as Dict,
    errors: nlErrors as Dict,
    legal: nlLegal as Dict,
  },
  de: {
    common: { ...deLegacy as Dict, ...deCommon as Dict },
    auth: deAuth as Dict,
    dashboard: deDashboard as Dict,
    credit: deCredit as Dict,
    investment: deInvestment as Dict,
    payments: dePayments as Dict,
    documents: deDocuments as Dict,
    notifications: deNotifications as Dict,
    admin: deAdmin as Dict,
    errors: deErrors as Dict,
    legal: deLegal as Dict,
  },
};

// Keep old flat for t() compat: merge all namespaces with prefix "ns:key" and also bare keys (legacy)
export const translations: Record<Locale, Record<string,string>> = {
  fr: flattenWithLegacy("fr"),
  en: flattenWithLegacy("en"),
  nl: flattenWithLegacy("nl"),
  de: flattenWithLegacy("de"),
};

function flattenWithLegacy(locale: Locale): Record<string,string> {
  const out: Record<string,string> = {};
  // legacy bare keys already in common
  for (const ns of namespaces) {
    for (const [k,v] of Object.entries(raw[locale][ns])) {
      out[`${ns}:${k}`] = v;
      // also expose bare for ns=common (hero etc.)
      if (ns === "common" && !out[k]) out[k] = v;
      // expose without prefix for convenience if key contains dot already (credit:simulator.title will also be accessible as simulator.title fallback)
    }
  }
  return out;
}

// --- ICU-like interpolation + plural ---
function interpolate(template: string, vars?: Record<string, any>, locale: Locale = defaultLocale): string {
  if (!vars) return template;
  // Handle plural: {count, plural, one {# document} other {# documents}}
  let out = template;
  // plural regex
  const pluralRe = /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g;
  out = out.replace(pluralRe, (_, varName: string, one: string, other: string) => {
    const n = Number(vars[varName] ?? 0);
    const rule = new Intl.PluralRules(localeToIntl[locale] as any).select(n);
    const chosen = rule === "one" ? one : other;
    return chosen.replace("#", String(n));
  });
  // simple {var} replacement
  out = out.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
  return out;
}

export const localeToIntl: Record<Locale, string> = { fr:"fr-BE", en:"en-BE", nl:"nl-BE", de:"de-BE" };

// Direction par locale — à compléter si une locale RTL (ar, he…) est ajoutée.
export const localeDir: Record<Locale, "ltr" | "rtl"> = { fr:"ltr", en:"ltr", nl:"ltr", de:"ltr" };

// t with namespace:key + vars + locale
export function t(locale: Locale, key: string, vars?: Record<string, any>): string {
  // Support both "ns:key" and bare "key" (legacy). If no colon, try common:key, then bare.
  let dictKey = key;
  let template: string | undefined;
  if (key.includes(":")) {
    template = translations[locale]?.[key] ?? translations[defaultLocale]?.[key];
  } else {
    // try namespaces in order: common, then credit, then ... but prefer common
    template = translations[locale]?.[key] ?? translations[locale]?.[`common:${key}`] ?? translations[defaultLocale]?.[key] ?? translations[defaultLocale]?.[`common:${key}`];
    // also search across all namespaces if not found (fallback)
    if (!template) {
      for (const ns of namespaces) {
        const cand = translations[locale]?.[`${ns}:${key}`];
        if (cand) { template = cand; break; }
      }
    }
  }
  if (!template) {
    if (typeof window !== "undefined") console.warn(`[i18n] missing key "${key}" for locale "${locale}"`);
    return key;
  }
  return interpolate(template, vars, locale);
}

// Namespace-aware helper: tNs('credit','simulator.title', {amount})
export function tNs(locale: Locale, ns: Namespace, key: string, vars?: Record<string, any>) {
  return t(locale, `${ns}:${key}`, vars);
}

// --- Détection (implémentation partagée avec middleware.ts) ---
export function parseAcceptLanguage(header: string | null | undefined): Locale | null {
  return sharedParseAcceptLanguage(header);
}

export function detectLocale(opts: {
  cookieLocale?: string | null,
  jwtLocale?: string | null,
  storedLocale?: string | null,
  acceptLanguage?: string | null,
  navigatorLanguages?: readonly string[],
  pathname?: string | null
}): Locale {
  return sharedDetectLocale(opts);
}

// --- Persistence ---
export const STORAGE_KEY = LOCALE_STORAGE_KEY;
export const COOKIE_NAME = LOCALE_COOKIE;
export const COOKIE_MAX_AGE = LOCALE_COOKIE_MAX_AGE; // 1y

// ⚠️ À appeler uniquement dans un effect / un handler (jamais pendant un render):
// ces API sont absentes du serveur et peuvent lever (Safari privé, cookies désactivés).
export function getPersistedLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (locales as readonly string[]).includes(stored)) return stored as Locale;
  } catch {} // Storage access refused (private mode / bloque)
  try {
    const fromCookie = cookieFromHeader(document.cookie, COOKIE_NAME);
    if (isSupportedLocale(fromCookie)) return fromCookie as Locale;
  } catch {}
  return null;
}

export function setPersistedLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
  try {
    document.cookie = `${COOKIE_NAME}=${locale}; ${localeCookieAttrs(window.location.protocol === "https:")}`;
  } catch {}
  // also PATCH /api/v1/customers/me {locale} if authenticated — caller handles
}

// Server helper (App Router)
export async function getTranslations(locale: Locale, ns: Namespace) {
  const dict = raw[locale]?.[ns] ?? raw[defaultLocale][ns];
  return (key: string, vars?: Record<string, any>) => {
    const tmpl = dict[key] ?? (raw[locale][ns] as any)[key] ?? key;
    return interpolate(tmpl, vars, locale);
  };
}

// Export raw for backend sync
export { raw as i18nRaw };
