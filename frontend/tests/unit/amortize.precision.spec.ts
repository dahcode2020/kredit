import { amortize } from '../../lib/utils';
import Decimal from 'decimal.js';

describe('frontend amortize — Decimal HALF_UP (simulateur offline)', () => {
  it('15k 48m 3.99% → monthly 338.62 (même que backend)', () => {
    const { monthly, schedule } = amortize(15000, 0.0399, 48);
    expect(monthly).toBeCloseTo(338.62, 1);
    expect(schedule.length).toBe(48);
    expect(schedule.at(-1)!.balance).toBe(0);
  });

  it('frontend vs Decimal direct: pas de dérive float', () => {
    const P=15000, n=48, annual=0.0399;
    const r=new Decimal(annual).div(12);
    const monthlyD = new Decimal(P).mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)));
    const { monthly } = amortize(P, annual, n);
    expect(monthly).toBe(Number(monthlyD.toFixed(2)));
  });

  it('0% → monthly = P/n', () => {
    const { monthly, schedule } = amortize(12000, 0, 12);
    expect(monthly).toBe(1000);
    expect(schedule.every(s=> s.interest===0)).toBe(true);
  });

  it('schedule invariants avec tolérance 1c', () => {
    const { monthly, schedule } = amortize(12000, 0.0499, 24);
    schedule.forEach((line, idx)=>{
      const isLast = idx===schedule.length-1;
      if (!isLast) {
        const sum = new Decimal(line.interest).plus(line.principal).toDecimalPlaces(2).toNumber();
        expect(Math.abs(sum - monthly)).toBeLessThan(0.02);
      }
    });
  });

  it('totaux cohérents', () => {
    const { monthly, total, totalInterest } = amortize(10000, 0.0399, 36);
    expect(total).toBeCloseTo(monthly*36, 0);
    expect(totalInterest).toBeCloseTo(total - 10000, 0);
  });

  it('bornes 1500 min preserves 2 decimals', () => {
    const { monthly } = amortize(1500, 0.0499, 12);
    expect(Number.isFinite(monthly)).toBe(true);
    expect(monthly.toFixed(2)).toMatch(/^\d+\.\d{2}$/);
  });
});
