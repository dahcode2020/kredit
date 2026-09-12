import { Injectable } from '@nestjs/common';
import { CreditRule, RateRule, ProductType, CountryCode } from '../types/credit-engine.types';
import { genererReglesTaux, PRODUITS, CODES_PRODUIT } from './grille.commerciale';
@Injectable()
export class RulesService {
  /**
   * Grille GÉNÉRÉE (produits × paliers) depuis `grille.commerciale.ts`. Avant: cinq lignes recopiées
   * à la main, dont un `rate_BE_MORTGAGE_ALL` qui couvrait 50 000-500 000 à un taux unique — donc un
   * emprunt de 49 000 € payait 4,99 % et un emprunt de 50 001 € passait à 4,50 % sans jamais voir le
   * 3,25 % annoncé: les paliers du produit et les paliers commerciaux n'étaient pas les mêmes.
   */
  private rateRules: RateRule[] = genererReglesTaux('BE');
  private creditRules: CreditRule[] = [
    { key:'max_debt_ratio', value:0.33, isHard:false, category:'eligibility', needsLegalValidation:true, country:'BE' },
    { key:'max_debt_ratio_hard', value:0.55, isHard:true, category:'eligibility' },
    { key:'min_age', value:18, isHard:true, category:'eligibility', needsLegalValidation:true },
    { key:'max_age', value:75, isHard:false, category:'eligibility' },
    { key:'min_income', value:900, isHard:false, category:'eligibility' },
    { key:'scoring_weights', value:{ debtRatio:35, incomeStability:25, employment:20, purpose:10, term:10 }, isHard:false, category:'scoring' },
    { key:'required_docs_PERSONAL', value:['ID','INCOME_3M','PROOF_ADDRESS'], isHard:false, category:'docs' },
    { key:'required_docs_MORTGAGE', value:['ID','INCOME_3M','PROOF_ADDRESS','PROPERTY_VALUATION','BANK_STATEMENTS_3M'], isHard:false, category:'docs' },
    { key:'required_docs_BUSINESS', value:['ID','INCOME_3M','PROOF_ADDRESS','TAX_RETURN_2Y','BUSINESS_PLAN'], isHard:false, category:'docs' },
    // Un investissement s'appuie sur la capacité financière autant que sur le projet: les justificatifs
    // du professionnel, sans plan d'affaires. Miroir de `docsParProduit` côté frontend.
    { key:'required_docs_INVESTMENT', value:['ID','INCOME_3M','PROOF_ADDRESS','BANK_STATEMENTS_3M','TAX_RETURN_2Y'], isHard:false, category:'docs' },
    // Plafonds par produit: dérivés de la même table que les taux. Le `?? 50000` de
    // `CreditEngineService` ne sert plus que de dernier recours — un produit ajouté à `PRODUITS` est
    // plafonné tout seul, au lieu d'hériter silencieusement du plafond du prêt personnel.
    ...CODES_PRODUIT.map((code): CreditRule => ({
      key: `max_amount_${code}_BE`, value: PRODUITS[code].max, isHard: true, category: 'eligibility', country: 'BE', product: code,
    })),
    ...CODES_PRODUIT.map((code): CreditRule => ({
      key: `min_amount_${code}_BE`, value: PRODUITS[code].min, isHard: true, category: 'eligibility', country: 'BE', product: code,
    })),
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
