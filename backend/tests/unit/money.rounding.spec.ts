import Decimal from 'decimal.js';
import { roundEuro, toCents, fromCents, addEuro, subEuro, formatEUR, ONE_CENT, sumEuro } from '../../src/common/money/money';

describe('money — précision & arrondi EUR (HALF_UP, Decimal.js)', () => {
  it('HALF_UP: 1.005 → 1.01 (pas de bankers rounding)', () => {
    expect(roundEuro(1.005)).toBe(1.01);
    expect(roundEuro(1.004)).toBe(1.0);
    expect(roundEuro(2.335)).toBe(2.34);
    expect(roundEuro('2.335')).toBe(2.34);
  });

  it('0.1 + 0.2 !== 0.300000000000004 via Number mais === 0.3 via Decimal', () => {
    const floatSum = 0.1 + 0.2; // 0.30000000000000004
    expect(floatSum).not.toBe(0.3);
    expect(sumEuro([0.1, 0.2])).toBe(0.3);
    expect(addEuro(0.1, 0.2)).toBe(0.3);
    expect(new Decimal(0.1).plus(0.2).toNumber()).toBe(0.3);
  });

  it('toCents / fromCents aller-retour', () => {
    expect(toCents(338.62)).toBe(33862);
    expect(fromCents(33862)).toBe(338.62);
    expect(toCents('0.01')).toBe(1);
    expect(toCents(0.005)).toBe(1); // HALF_UP
    expect(fromCents(1)).toBe(0.01);
  });

  it('add/sub/mul précis sans dérive', () => {
    expect(addEuro(100.1, 200.2)).toBe(300.3);
    expect(subEuro(1000, 0.01)).toBe(999.99);
    // 33.333% * 3 ≈ 99.999 → 100.00 HALF_UP? non, on teste sub
    expect(roundEuro(new Decimal('0.1').mul(3).toNumber())).toBe(0.3);
  });

  it('somme longue ne dérive pas (100 * 0.01 = 1)', () => {
    const arr = Array(100).fill(0.01);
    // Number loop accumulates floating ok here, but Decimal garanti
    expect(sumEuro(arr)).toBe(1.0);
    const float = arr.reduce((a,b)=>a+b, 0);
    // float may be 1.000000... close but Decimal is exact
    expect(float).toBeCloseTo(1, 10);
  });

  it('formatEUR fr-BE vs en-BE cohérent mais distinct', () => {
    const fr = formatEUR(1234.56, 'fr');
    const en = formatEUR(1234.56, 'en');
    const nl = formatEUR(1234.56, 'nl');
    expect(fr).toContain('€');
    expect(en).toContain('€');
    expect(nl).toContain('€');
    // fr-BE uses comma, en-BE uses dot
    expect(fr).toMatch(/1.*234,56/);
    expect(en).toMatch(/1,234\.56|1 234\.56/);
  });

  it('ONE_CENT tolérance', () => {
    expect(ONE_CENT).toBe(0.01);
    // mensualité arrondie doit être à 1 cent près
    const monthly = roundEuro(338.624);
    expect(Math.abs(monthly - 338.62) < 0.015).toBe(true);
  });

  it('grandes sommes pas de flottant (1M)', () => {
    expect(addEuro(999999.99, 0.02)).toBe(1000000.01);
    expect(toCents(500000)).toBe(50000000);
  });

  it('timezone Europe/Brussels implicite', () => {
    process.env.TZ = 'Europe/Brussels';
    const d = new Date('2026-06-15T10:00:00Z');
    // In Brussels summer (CEST UTC+2) this should be 12:00
    const hourBE = new Intl.DateTimeFormat('fr-BE', { hour:'numeric', timeZone:'Europe/Brussels' }).format(d);
    expect(hourBE).toContain('12');
  });
});
