import { Injectable } from '@nestjs/common';
import { SimulateInput, EligibilityResult, RuleFailure } from '../types/credit-engine.types';
import { RulesService } from '../rules/rules.service';
@Injectable()
export class EligibilityEngine {
  constructor(private rules: RulesService) {}
  check(input: SimulateInput, simulation: { monthlyPayment:number }, productType:string, country:string): EligibilityResult {
    const hard: RuleFailure[] = [];
    const soft: RuleFailure[] = [];
    const monthly = simulation.monthlyPayment;
    const existing = input.existingCreditsMonthly ?? 0;
    const debtRatio = input.monthlyIncome > 0 ? (monthly + existing + input.monthlyCharges) / input.monthlyIncome : Infinity;
    const capacity = input.monthlyIncome - input.monthlyCharges - existing - monthly;
    const maxKey = `max_amount_${productType}_${country}`;
    const maxAmount = this.rules.getValue(maxKey, country, productType) ?? this.rules.getValue('max_amount_PERSONAL_BE', country, productType) ?? 50000;
    if (input.amount > maxAmount) hard.push({ rule:maxKey, message:`Montant ${input.amount} > plafond ${maxAmount} ${country}`, threshold:maxAmount, value:input.amount, isHard:true });
    if (input.birthDate) {
      const age = this.age(input.birthDate);
      const minAge = this.rules.getValue('min_age', country) ?? 18;
      const maxAge = this.rules.getValue('max_age', country) ?? 75;
      if (age < minAge) hard.push({ rule:'min_age', message:`Âge ${age} < ${minAge} requis`, threshold:minAge, value:age, isHard:true });
      if (age > maxAge) soft.push({ rule:'max_age', message:`Âge ${age} > ${maxAge} (risque)`, threshold:maxAge, value:age, isHard:false });
    }
    const maxDebt = this.rules.getValue('max_debt_ratio', country) ?? 0.33;
    if (debtRatio > maxDebt) soft.push({ rule:'max_debt_ratio', message:`Endettement ${(debtRatio*100).toFixed(1)}% > ${(maxDebt*100).toFixed(0)}%`, threshold:maxDebt, value:debtRatio, isHard:false });
    const hardDebt = this.rules.getValue('max_debt_ratio_hard') ?? 0.55;
    if (debtRatio > hardDebt) hard.push({ rule:'max_debt_ratio_hard', message:`Surendettement ${(debtRatio*100).toFixed(1)}% > ${(hardDebt*100).toFixed(0)}%`, threshold:hardDebt, value:debtRatio, isHard:true });
    const minIncome = this.rules.getValue('min_income') ?? 900;
    if (input.monthlyIncome < minIncome) soft.push({ rule:'min_income', message:`Revenus ${input.monthlyIncome} < ${minIncome}`, threshold:minIncome, value:input.monthlyIncome, isHard:false });
    if (input.monthlyCharges > input.monthlyIncome * 0.9) hard.push({ rule:'charges_vs_income', message:`Charges ${input.monthlyCharges} > 90% revenus`, threshold:input.monthlyIncome*0.9, value:input.monthlyCharges, isHard:true });
    const isEligible = hard.length===0;
    let maxAllowed: number|null = null;
    if (debtRatio > maxDebt && isEligible) {
      const allowedMonthly = input.monthlyIncome * maxDebt - input.monthlyCharges - existing;
      if (allowedMonthly > 0) { maxAllowed = Math.max(0, Math.floor(allowedMonthly * input.termMonths * 0.9)); maxAllowed = Math.min(maxAllowed, maxAmount); }
    }
    return { isEligible, hardFailures: hard, softFailures: soft, debtRatio: Number(debtRatio.toFixed(4)), repaymentCapacity: Number(capacity.toFixed(2)), maxAllowedAmount: maxAllowed };
  }
  private age(iso:string): number { const b = new Date(iso); const now = new Date(); let a = now.getFullYear() - b.getFullYear(); const m = now.getMonth() - b.getMonth(); if (m<0 || (m===0 && now.getDate()<b.getDate())) a--; return a; }
}
