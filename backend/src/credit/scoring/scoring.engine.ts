import { Injectable } from '@nestjs/common';
import { SimulateInput, ScoringResult, ScoreGrade } from '../types/credit-engine.types';
import { RulesService } from '../rules/rules.service';
@Injectable()
export class ScoringEngine {
  constructor(private rules: RulesService) {}
  score(input: SimulateInput, debtRatio:number, productType:string): ScoringResult {
    const weights = this.rules.getValue('scoring_weights') ?? { debtRatio:35, incomeStability:25, employment:20, purpose:10, term:10 };
    const breakdown: Record<string,number> = {};
    breakdown.debtRatio = this.scoreDebt(debtRatio, weights.debtRatio);
    breakdown.incomeStability = this.scoreIncomeStability(input.incomeType, weights.incomeStability);
    breakdown.employment = this.scoreEmployment(input.employmentStatus, weights.employment);
    breakdown.purpose = this.scorePurpose(input.loanPurpose, weights.purpose);
    const maxTerm = productType==='MORTGAGE'?300: productType==='BUSINESS'?120:84;
    const termRatio = input.termMonths / maxTerm;
    breakdown.term = termRatio <=0.5 ? weights.term : termRatio<=0.8 ? Math.round(weights.term*0.5) : Math.round(weights.term*0.2);
    const value = Object.values(breakdown).reduce((a,b)=>a+b,0);
    const grade:ScoreGrade = value>=80 ? 'A' : value>=65 ? 'B' : value>=45 ? 'C' : value>=25 ? 'D' : 'E';
    const explanation = this.explain(value, grade, debtRatio, breakdown);
    return { value, grade, breakdown, explanation };
  }
  private scoreDebt(ratio:number, max:number): number { if (ratio <=0.33) return max; if (ratio <=0.40) return Math.round(max*0.57); if (ratio <=0.50) return Math.round(max*0.22); return 0; }
  private scoreIncomeStability(t:string, max:number): number { const map: Record<string, number> = { SALARY:1, PENSION:0.8, SELF_EMPLOYED:0.6, OTHER:0.4, UNEMPLOYMENT:0.14 }; return Math.round(max * (map[t] ?? 0.4)); }
  private scoreEmployment(s:string, max:number): number { const map: Record<string,number> = { CDI:1, RETIRED:0.8, INDEPENDENT:0.7, CDD:0.6, INTERIM:0.45, STUDENT:0.3, UNEMPLOYED:0 }; return Math.round(max * (map[s] ?? 0.3)); }
  private scorePurpose(p:string, max:number): number { const map: Record<string,number> = { VEHICLE:1, WORKS:1, CONSUMPTION:0.7, MEDICAL:0.7, OTHER:0.6, DEBT_CONSOLIDATION:0.3 }; return Math.round(max * (map[p] ?? 0.6)); }
  private explain(v:number, g:ScoreGrade, debt:number, b:Record<string,number>): string { if (g==='A') return `Excellent (${v}) — endettement ${(debt*100).toFixed(1)}% maîtrisé`; if (g==='B') return `Bon (${v}) — endettement ${(debt*100).toFixed(1)}%, profil stable`; if (g==='C') return `Moyen (${v}) — endettement ${(debt*100).toFixed(1)}% >33%, à examiner`; if (g==='D') return `Fragile (${v}) — endettement ${(debt*100).toFixed(1)}% élevé`; return `Très fragile (${v}) — endettement ${(debt*100).toFixed(1)}% ou revenus instables`; }
}
