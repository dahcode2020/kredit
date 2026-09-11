import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type Locale = 'fr' | 'en' | 'nl' | 'de';
export const locales: Locale[] = ['fr','en','nl','de'];
export const defaultLocale: Locale = 'fr';
export type Namespace = 'common'|'auth'|'dashboard'|'credit'|'investment'|'payments'|'documents'|'notifications'|'admin'|'errors'|'legal';

@Injectable()
export class I18nService {
  private cache = new Map<string, Record<string,string>>();

  private load(locale: Locale, ns: Namespace): Record<string,string> {
    const key = `${locale}:${ns}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const base = path.join(__dirname, 'locales', locale, `${ns}.json`);
    let data: Record<string,string> = {};
    try { data = JSON.parse(fs.readFileSync(base,'utf8')); } catch {}
    // fr-BE override
    if (locale === 'fr') {
      try {
        const overridePath = path.join(__dirname, 'locales', 'fr', 'fr-BE.json');
        const ov = JSON.parse(fs.readFileSync(overridePath,'utf8'));
        data = { ...data, ...ov };
      } catch {}
    }
    this.cache.set(key, data);
    return data;
  }

  t(locale: Locale, key: string, vars?: Record<string, any>): string {
    // key: "ns:key" or "ns.key" or bare
    let ns: string | undefined;
    let k = key;
    if (key.includes(':')) [ns, k] = key.split(':');
    else if (key.includes('.') && locales.includes(key.split('.')[0] as any)) { /* ignore */ }

    let tmpl: string | undefined;
    if (ns && this.isNamespace(ns)) {
      tmpl = this.load(locale as Locale, ns as Namespace)[k] ?? this.load(defaultLocale, ns as Namespace)[k];
    } else {
      // search all namespaces, prefer common
      tmpl = this.load(locale as Locale, 'common')[k] ?? this.load(defaultLocale, 'common')[k];
      if (!tmpl) {
        for (const n of ['common','auth','dashboard','credit','investment','payments','documents','notifications','admin','errors','legal'] as Namespace[]) {
          tmpl = this.load(locale as Locale, n)[k] ?? this.load(defaultLocale, n)[k];
          if (tmpl) break;
        }
      }
    }
    if (!tmpl) return key;
    return this.interpolate(tmpl, vars, locale);
  }

  tNs(locale: Locale, ns: Namespace, key: string, vars?: Record<string,any>) {
    return this.t(locale, `${ns}:${key}`, vars);
  }

  private isNamespace(v: string): boolean {
    return ['common','auth','dashboard','credit','investment','payments','documents','notifications','admin','errors','legal'].includes(v);
  }

  private interpolate(template: string, vars?: Record<string,any>, locale: Locale = defaultLocale): string {
    if (!vars) return template;
    // plural: {count, plural, one {# document} other {# documents}}
    let out = template;
    const pluralRe = /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\}/g;
    out = out.replace(pluralRe, (_, varName: string, one: string, other: string) => {
      const n = Number(vars[varName] ?? 0);
      const rule = new Intl.PluralRules(this.localeToIntl(locale)).select(n);
      const chosen = rule === 'one' ? one : other;
      return chosen.replace('#', String(n));
    });
    out = out.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
    return out;
  }

  localeToIntl(locale: Locale): string {
    const map: Record<Locale,string> = { fr:'fr-BE', en:'en-BE', nl:'nl-BE', de:'de-BE' };
    return map[locale] ?? 'fr-BE';
  }

  // formatters (same as frontend/lib/formatters)
  formatDate(date: Date, locale: Locale) {
    return new Intl.DateTimeFormat(this.localeToIntl(locale), { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'Europe/Brussels' }).format(date);
  }
  formatCurrency(n: number, locale: Locale) {
    return new Intl.NumberFormat(this.localeToIntl(locale), { style:'currency', currency:'EUR', minimumFractionDigits:2 }).format(n);
  }
  formatPercent(n: number, locale: Locale) {
    return new Intl.NumberFormat(this.localeToIntl(locale), { style:'percent', minimumFractionDigits:1 }).format(n);
  }
  formatPhoneBE(raw: string) {
    // lightweight without libphonenumber-js for backend (validate via regex)
    return raw.replace(/(\\+32)(\\d{3})(\\d{2})(\\d{2})(\\d{2})/, '$1 $2 $3 $4 $5');
  }
}
