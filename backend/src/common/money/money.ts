/**
 * KREDIT — Règles de précision & arrondi monétaire
 * EUR uniquement (BE), ICS 4217, time zone Europe/Brussels
 * Interdit: Number float pour calculs financiers — obligatoire Decimal.js
 */
import Decimal from 'decimal.js';

// Config Decimal global: précision 28 chiffres, arrondi HALF_UP (demi-supérieur)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP, maxE: 1e9, minE: -1e9 });

export const CURRENCY = 'EUR' as const;
export const MONEY_SCALE = 2; // cents
export const TIMEZONE = 'Europe/Brussels';
export const LOCALE_BE: Record<string,string> = { fr:'fr-BE', nl:'nl-BE', de:'de-BE', en:'en-BE' };

/** Arrondi demi-supérieur à 2 décimales — norme bancaire BE (half up, pas bankers) */
export function roundEuro(value: number | string | Decimal): number {
  return new Decimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP).toNumber();
}
export function roundEuroDecimal(value: Decimal): Decimal {
  return value.toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}
export function toCents(euro: number | string | Decimal): number {
  return new Decimal(euro as any).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}
export function fromCents(cents: number): number {
  return new Decimal(cents).div(100).toDecimalPlaces(MONEY_SCALE).toNumber();
}
export function addEuro(a: number | Decimal, b: number | Decimal): number {
  return roundEuro(new Decimal(a).plus(b));
}
export function subEuro(a: number | Decimal, b: number | Decimal): number {
  return roundEuro(new Decimal(a).minus(b));
}
export function mulEuro(a: number | Decimal, b: number | Decimal): number {
  return roundEuro(new Decimal(a).mul(b));
}
export function divEuro(a: number | Decimal, b: number | Decimal): number {
  return roundEuro(new Decimal(a).div(b));
}
/** Somme précise d'un tableau — évite erreur cumulative float */
export function sumEuro(values: (number|Decimal)[]): number {
  return values.reduce((acc, v) => new Decimal(acc).plus(v).toNumber(), 0) // garde précision puis round final
    ? roundEuro(values.reduce((acc, v) => new Decimal(acc).plus(v), new Decimal(0)))
    : 0;
}
export function equalsEuro(a: number, b: number): boolean {
  return new Decimal(a).equals(new Decimal(b));
}
export function compareEuro(a: number, b: number): number {
  return new Decimal(a).comparedTo(b);
}
/** Tolérance 1 cent pour assertions tests */
export const ONE_CENT = 0.01;

/** Formatting EUR avec Intl, locale BE */
export function formatEUR(amount: number, locale: 'fr'|'nl'|'de'|'en' = 'fr'): string {
  const intlLocale = LOCALE_BE[locale] ?? 'fr-BE';
  return new Intl.NumberFormat(intlLocale, { style:'currency', currency:CURRENCY, minimumFractionDigits:2, maximumFractionDigits:2 }).format(amount);
}
export function formatEURInt(amount: number, locale: 'fr'|'nl'|'de'|'en'='fr'): string {
  const intlLocale = LOCALE_BE[locale] ?? 'fr-BE';
  return new Intl.NumberFormat(intlLocale, { style:'currency', currency:CURRENCY, maximumFractionDigits:0 }).format(amount);
}
/** Date helpers — toujours Europe/Brussels, 12:00 midi pour éviter DST */
export function dueDateBrussels(monthsFromNow: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + monthsFromNow);
  // set to 10th of month at 12:00 Brussels (approx via UTC+1/2, but stored UTC)
  // Use Intl to get Brussels components
  const brussels = new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
  brussels.setDate(10);
  brussels.setHours(12,0,0,0);
  return brussels;
}
export function formatDateBE(date: Date, locale: 'fr'|'nl'|'de'|'en'='fr'): string {
  const intlLocale = LOCALE_BE[locale] ?? 'fr-BE';
  return new Intl.DateTimeFormat(intlLocale, { dateStyle:'medium', timeZone: TIMEZONE }).format(date);
}

/** Règle: ne jamais utiliser `+ - * /` sur number pour montants — passer par Decimal */
export const MoneyRules = {
  currency: CURRENCY,
  scale: MONEY_SCALE,
  rounding: 'HALF_UP (Decimal.ROUND_HALF_UP)',
  timezone: TIMEZONE,
  forbidden: 'Number float ops, toFixed sans Decimal, parseFloat sur montant',
  db: 'NUMERIC(15,2) — mapping Decimal ↔ string, jamais float',
  invariants: [
    'schedule[i].interest + schedule[i].principal === monthlyPayment (±1 cent ajusté dernier mois)',
    'sum(schedule.principal) === principal',
    'totalCost === monthly*N + fees (cap 10% principal)',
    'balance dernier mois === 0',
  ],
} as const;
