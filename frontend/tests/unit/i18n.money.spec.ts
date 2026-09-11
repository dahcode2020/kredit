import { formatEUR, formatEUR2 } from '../../lib/utils';
import { localeToIntl } from '../../lib/formatters';

describe('i18n — EUR formatting locales BE', () => {
  it('fr-BE 1 234,56 € vs en-BE €1,234.56 structure differente mais 2 décimales', () => {
    const fr = formatEUR2(1234.56, 'fr');
    const en = formatEUR2(1234.56, 'en');
    const nl = formatEUR2(1234.56, 'nl');
    expect(fr).toContain('€');
    expect(en).toContain('€');
    expect(nl).toContain('€');
    expect(fr).toMatch(/1.*234,56/);
    // en-BE often €1,234.56 or 1,234.56 €
    expect(en).toMatch(/1,?234[.,]56/);
  });

  it('formatEUR zero decimal vs formatEUR2 2 decimals', () => {
    const z = formatEUR(15000, 'fr');
    const d = formatEUR2(15000, 'fr');
    expect(z).toContain('15');
    expect(d).toContain('15');
    expect(d).toMatch(/,00/);
  });

  it('la locale applicative change réellement la sortie (verrou du tag en dur)', () => {
    const out = (['fr', 'en', 'nl', 'de'] as const).map((l) => formatEUR2(1234.56, l));
    expect(new Set(out).size).toBe(4);
    // `nl`/`de` ne doivent plus jamais tomber sur le rendu francais (l'ancien `formatEUR2(v, 'fr-BE')`)
    expect(out[2]).not.toBe(out[0]);
    expect(out[3]).not.toBe(out[0]);
    expect(localeToIntl.nl).toBe('nl-BE');
    expect(localeToIntl.de).toBe('de-BE');
  });

  it('Intl.NumberFormat timeZone Europe/Brussels coherente', () => {
    const d = new Date('2026-06-15T10:00:00Z');
    const hour = new Intl.DateTimeFormat('fr-BE', { hour:'2-digit', hour12:false, timeZone:'Europe/Brussels' }).formatToParts(d).find(p=>p.type==='hour')!.value;
    expect(hour).toBe('12');
  });

  it('change langue: cookie NEXT_LOCALE & localStorage', () => {
    document.cookie = 'NEXT_LOCALE=nl; path=/';
    expect(document.cookie).toContain('NEXT_LOCALE=nl');
    localStorage.setItem('kredit-install-dismissed', 'true');
    expect(localStorage.getItem('kredit-install-dismissed')).toBe('true');
  });
});
