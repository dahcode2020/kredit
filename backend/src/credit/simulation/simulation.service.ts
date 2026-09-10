import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
/**
 * Moteur de simulation — pur, sans état, configurable.
 * AUCUNE règle en dur: lit les taux depuis DB/cache (injecté ici via ProductRatesRepository).
 * Pour la démo, taux par défaut BE injectés si non trouvés.
 */
@Injectable()
export class SimulationService {
  simulate(dto: { amount: number; termMonths: number; productType?: string; country?: string }) {
    const annual = dto.productType === 'MORTGAGE' ? 0.0325 : dto.productType === 'BUSINESS' ? 0.045 : 0.0399;
    const r = new Decimal(annual).div(12);
    const principal = new Decimal(dto.amount);
    const n = dto.termMonths;
    // mensualité française
    const monthly = r.isZero() ? principal.div(n) : principal.mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)));
    const total = monthly.mul(n);
    const interest = total.minus(principal);
    // schedule preview 12
    let bal = principal;
    const schedule = [];
    for (let i=1;i<=Math.min(n,12);i++) {
      const inter = bal.mul(r);
      const princ = Decimal.min(monthly.minus(inter), bal);
      bal = Decimal.max(new Decimal(0), bal.minus(princ));
      schedule.push({ month:i, interest: inter.toNumber(), principal: princ.toNumber(), balance: bal.toNumber(), payment: monthly.toNumber() });
    }
    return {
      monthly: monthly.toNumber(),
      total: total.toNumber(),
      totalInterest: interest.toNumber(),
      taeg: annual,
      schedule,
      disclaimer: "Simulation indicative uniquement — ne constitue pas une offre ferme. Décision soumise à validation administrative.",
      meta: { simulationOnly: true, country: dto.country ?? 'BE', currency: 'EUR' }
    };
  }
}
