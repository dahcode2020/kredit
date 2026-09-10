import { Injectable } from '@nestjs/common';
import { CreditRule, RateRule, ProductType, CountryCode } from '../types/credit-engine.types';
@Injectable()
export class RulesService {
  private rateRules: RateRule[] = [
    { id: 'rate_BE_PERSONAL_1500_10000', country:'BE', product:'PERSONAL', minAmount:1500, maxAmount:10000, minTerm:12, maxTerm:60, baseRate:0.0499, fees:{ filePct:0.01, fileMin:75, fileMax:200 }, effectiveFrom:'2026-01-01' },
    { id: 'rate_BE_PERSONAL_10001_25000', country:'BE', product:'PERSONAL', minAmount:10001, maxAmount:25000, minTerm:12, maxTerm:72, baseRate:0.0399, fees:{ filePct:0.01, fileMin:75, fileMax:300 }, effectiveFrom:'2026-01-01' },
    { id: 'rate_BE_PERSONAL_25001_50000', country:'BE', product:'PERSONAL', minAmount:25001, maxAmount:50000, minTerm:12, maxTerm:84, baseRate:0.0449, fees:{ filePct:0.01, fileMin:75, fileMax:400 }, effectiveFrom:'2026-01-01' },
    { id: 'rate_BE_MORTGAGE_ALL', country:'BE', product:'MORTGAGE', minAmount:50000, maxAmount:500000, minTerm:60, maxTerm:300, baseRate:0.0325, fees:{ filePct:0.005, fileMin:200, fileMax:1000 }, effectiveFrom:'2026-01-01' },
    { id: 'rate_BE_BUSINESS_ALL', country:'BE', product:'BUSINESS', minAmount:5000, maxAmount:250000, minTerm:12, maxTerm:120, baseRate:0.045, fees:{ filePct:0.015, fileMin:150, fileMax:1500 }, effectiveFrom:'2026-01-01' },
  ];
  private creditRules: CreditRule[] = [
    { key:'max_debt_ratio', value:0.33, isHard:false, category:'eligibility', needsLegalValidation:true, country:'BE' },
    { key:'max_debt_ratio_hard', value:0.55, isHard:true, category:'eligibility' },
    { key:'min_age', value:18, isHard:true, category:'eligibility', needsLegalValidation:true },
    { key:'max_age', value:75, isHard:false, category:'eligibility' },
    { key:'max_amount_PERSONAL_BE', value:50000, isHard:true, category:'eligibility', country:'BE', product:'PERSONAL' },
    { key:'max_amount_MORTGAGE_BE', value:500000, isHard:true, category:'eligibility', country:'BE', product:'MORTGAGE' },
    { key:'min_income', value:900, isHard:false, category:'eligibility' },
    { key:'scoring_weights', value:{ debtRatio:35, incomeStability:25, employment:20, purpose:10, term:10 }, isHard:false, category:'scoring' },
    { key:'required_docs_PERSONAL', value:['ID','INCOME_3M','PROOF_ADDRESS'], isHard:false, category:'docs' },
    { key:'required_docs_MORTGAGE', value:['ID','INCOME_3M','PROOF_ADDRESS','PROPERTY_VALUATION','BANK_STATEMENTS_3M'], isHard:false, category:'docs' },
    { key:'required_docs_BUSINESS', value:['ID','INCOME_3M','PROOF_ADDRESS','TAX_RETURN_2Y','BUSINESS_PLAN'], isHard:false, category:'docs' },
  ];
  getRateRule(country: CountryCode, product: ProductType, amount:number, term:number): RateRule | null {
    const candidates = this.rateRules.filter(r => r.country===country && r.product===product && amount>=r.minAmount && amount<=r.maxAmount && term>=r.minTerm && term<=r.maxTerm && (!r.effectiveTo || new Date(r.effectiveTo) > new Date()));
    if (candidates.length===0) return null;
    candidates.sort((a,b)=> new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
    return candidates[0];
  }
  getRule(key:string, country?:string, product?:string): CreditRule | undefined {
    return this.creditRules.find(r=> r.key===key && r.country===country && r.product===product) ?? this.creditRules.find(r=> r.key===key && r.country===country && !r.product) ?? this.creditRules.find(r=> r.key===key && !r.country && !r.product);
  }
  getValue(key:string, country?:string, product?:string, fallback?:any): any {
    const r = this.getRule(key, country, product);
    if (!r) return fallback;
    return r.value;
  }
  __setRules(rules: CreditRule[]) { this.creditRules = rules; }
  __setRateRules(rules: RateRule[]) { this.rateRules = rules; }
}
