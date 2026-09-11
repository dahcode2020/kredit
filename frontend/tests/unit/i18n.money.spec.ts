import { formatEUR, formatEUR2 } from '../../lib/utils';

describe('i18n — EUR formatting locales BE', () => {
  it('fr-BE 1 234,56 € vs en-BE €1,234.56 structure differente mais 2 décimales', () => {
    const fr = formatEUR2(1234.56, 'fr-BE');
    const en = formatEUR2(1234.56, 'en-BE');
    const nl = formatEUR2(1234.56, 'nl-BE');
    expect(fr).toContain('€');
    expect(en).toContain('€');
    expect(nl).toContain('€');
    expect(fr).toMatch(/1.*234,56/);
    // en-BE often €1,234.56 or 1,234.56 €
    expect(en).toMatch(/1,?234[.,]56/);
  });

  it('formatEUR zero decimal vs formatEUR2 2 decimals', () => {
    const z = formatEUR(15000, 'fr-BE');
    const d = formatEUR2(15000, 'fr-BE');
    expect(z).toContain('15');
    expect(d).toContain('15');
    expect(d).toMatch(/,00/);
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
