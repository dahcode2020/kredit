import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { AmortizationLine, RateRule } from '../types/credit-engine.types';
export interface SimulationInput { principal: number; termMonths: number; rateRule: RateRule; }
@Injectable()
export class SimulationEngine {
  simulate(input: SimulationInput) {
    const { principal, termMonths, rateRule } = input;
    const P = new Decimal(principal);
    const n = termMonths;
    const annual = new Decimal(rateRule.baseRate);
    const r = annual.div(12);
    const monthly = r.isZero() ? P.div(n) : P.mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)));
    const total = monthly.mul(n);
    const totalInterest = total.minus(P);
    const filePct = rateRule.fees.filePct ?? 0;
    const fileMin = rateRule.fees.fileMin ?? 0;
    const fileMax = rateRule.fees.fileMax ?? Number.MAX_SAFE_INTEGER;
    let fileFee = P.mul(filePct);
    if (fileFee.lessThan(fileMin)) fileFee = new Decimal(fileMin);
    if (fileFee.greaterThan(fileMax)) fileFee = new Decimal(fileMax);
    if (filePct === 0 && fileMin === 0) fileFee = new Decimal(0);
    const insurancePct = rateRule.fees.insurancePct ?? 0;
    const insuranceFee = P.mul(insurancePct).mul(n).div(12);
    const feesTotal = fileFee.plus(insuranceFee);
    const cappedFees = Decimal.min(feesTotal, P.mul(0.1));
    const totalCost = total.plus(cappedFees);
    const taegApprox = annual.plus(cappedFees.div(P).div(n/12));
    const schedule: AmortizationLine[] = [];
    let balance = P;
    for (let i=1;i<=n;i++) {
      const interest = balance.mul(r);
      const principalPart = Decimal.min(monthly.minus(interest), balance);
      balance = Decimal.max(new Decimal(0), balance.minus(principalPart));
      schedule.push({ month: i, payment: Number(monthly.toFixed(2)), interest: Number(interest.toFixed(2)), principal: Number(principalPart.toFixed(2)), balance: Number(balance.toFixed(2)) });
    }
    return { monthlyPayment: Number(monthly.toFixed(2)), annualRate: Number(annual.toFixed(4)), taeg: Number(taegApprox.toFixed(4)), totalInterest: Number(totalInterest.toFixed(2)), fees: { file: Number(fileFee.toFixed(2)), insurance: Number(insuranceFee.toFixed(2)), total: Number(cappedFees.toFixed(2)) }, totalCost: Number(totalCost.toFixed(2)), schedule, disclaimer: "Simulation indicative uniquement — ne constitue pas une offre ferme. TAEG indicatif hors assurances complémentaires. Décision soumise à validation administrative (ADMIN). Validation juridique requise pour offre SECCI.", meta: { rateRuleId: rateRule.id } };
  }
}
