import { Injectable, BadRequestException } from '@nestjs/common';
import { SimulateInput, CreditEngineOutput, RequiredDocument, Warning, ProductType } from './types/credit-engine.types';
import { RulesService } from './rules/rules.service';
import { SimulationEngine } from './simulation/simulation.engine';
import { EligibilityEngine } from './eligibility/eligibility.engine';
import { ScoringEngine } from './scoring/scoring.engine';
import { DecisionEngine } from './decision-engine/decision.engine';
@Injectable()
export class CreditEngineService {
  constructor(private rules: RulesService, private simulation: SimulationEngine, private eligibility: EligibilityEngine, private scoring: ScoringEngine, private decision: DecisionEngine) {}
  simulate(input: SimulateInput): CreditEngineOutput {
    const country = (input.country ?? 'BE').toUpperCase();
    const product: ProductType = input.productType ?? this.inferProduct(input.amount);
    const rateRule = this.rules.getRateRule(country, product, input.amount, input.termMonths);
    if (!rateRule) throw new BadRequestException({ code:'NO_RATE_RULE', message:`Aucune grille de taux pour ${country} ${product} ${input.amount}€/${input.termMonths}m` });
    const sim = this.simulation.simulate({ principal: input.amount, termMonths: input.termMonths, rateRule });
    const simulation = { monthlyPayment: sim.monthlyPayment, annualRate: sim.annualRate, taeg: sim.taeg, totalInterest: sim.totalInterest, fees: sim.fees, totalCost: sim.totalCost, schedule: sim.schedule, disclaimer: sim.disclaimer, meta: { country, product, rateRuleId: rateRule.id, generatedAt: new Date().toISOString() } };
    const eligibility = this.eligibility.check(input, simulation, product, country);
    const score = this.scoring.score(input, eligibility.debtRatio, product);
    const recommendation = this.decision.recommend(eligibility, score);
    const warnings: Warning[] = [];
    if (eligibility.debtRatio > 0.33) warnings.push({ code:'DEBT_RATIO_HIGH', message:`Endettement ${(eligibility.debtRatio*100).toFixed(1)}% > 33%`, severity:'high' });
    if (eligibility.debtRatio > 0.50) warnings.push({ code:'OVER_INDEBTED', message:'Surendettement >50%', severity:'high' });
    if (eligibility.repaymentCapacity < 500) warnings.push({ code:'LOW_CAPACITY', message:`Capacité résiduelle ${eligibility.repaymentCapacity}€ < 500€`, severity:'medium' });
    if (input.amount > 0.9 * (this.rules.getValue(`max_amount_${product}_${country}`, country, product) ?? 50000)) warnings.push({ code:'AT_CEILING', message:'Montant proche du plafond', severity:'low' });
    if (simulation.schedule.length !== input.termMonths) warnings.push({ code:'SCHEDULE_MISMATCH', message:'Échéancier incomplet', severity:'high' });
    if (!input.birthDate) warnings.push({ code:'AGE_NOT_PROVIDED', message:'Âge non vérifié — hard rule min_age non testée', severity:'low' });
    const docsKey = `required_docs_${product}`;
    const baseDocs: string[] = this.rules.getValue(docsKey) ?? ['ID','INCOME_3M','PROOF_ADDRESS'];
    const requiredDocuments: RequiredDocument[] = baseDocs.map(code=> ({ code, label: this.docLabel(code), required:true }));
    if (input.amount > 20000 && !baseDocs.includes('BANK_STATEMENTS_3M')) requiredDocuments.push({ code:'BANK_STATEMENTS_3M', label:'Extraits bancaires 3 mois', required:true, reason:'Montant >20k' });
    if (input.incomeType==='SELF_EMPLOYED' && !baseDocs.includes('TAX_RETURN_2Y')) requiredDocuments.push({ code:'TAX_RETURN_2Y', label:'Avertissements fiscaux 2 ans', required:true, reason:'Indépendant' });
    if (eligibility.debtRatio > 0.40) requiredDocuments.push({ code:'DEBT_DETAILS', label:'Détail crédits en cours', required:true, reason:'Endettement élevé' });
    return { simulation, eligibility, score, recommendation, warnings, requiredDocuments };
  }
  private inferProduct(amount:number): ProductType { if (amount >=50000) return 'MORTGAGE'; if (amount >=25000) return 'BUSINESS'; return 'PERSONAL'; }
  private docLabel(code:string): string { const m: Record<string,string> = { ID:"Carte d'identité / passeport", INCOME_3M:"3 fiches de paie", PROOF_ADDRESS:"Justificatif de domicile <3 mois", PROPERTY_VALUATION:"Estimation immobilière", BANK_STATEMENTS_3M:"Extraits bancaires 3 mois", TAX_RETURN_2Y:"Avertissements fiscaux 2 ans", BUSINESS_PLAN:"Business plan", DEBT_DETAILS:"Détail crédits en cours" }; return m[code] ?? code; }
}
