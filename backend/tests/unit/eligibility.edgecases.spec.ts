import { RulesService } from '../../src/credit/rules/rules.service';
import { EligibilityEngine } from '../../src/credit/eligibility/eligibility.engine';
import { SimulationEngine } from '../../src/credit/simulation/simulation.engine';
import { ScoringEngine } from '../../src/credit/scoring/scoring.engine';
import { DecisionEngine } from '../../src/credit/decision-engine/decision.engine';
import { CreditEngineService } from '../../src/credit/credit-engine.service';

function engine() {
  const rules = new RulesService();
  return {
    rules,
    elig: new EligibilityEngine(rules),
    sim: new SimulationEngine(),
    scoring: new ScoringEngine(rules),
    decision: new DecisionEngine(),
    credit: new CreditEngineService(rules, new SimulationEngine(), new EligibilityEngine(rules), new ScoringEngine(rules), new DecisionEngine()),
  };
}

describe('eligibility — cas limites', () => {
  it('revenus nuls → debtRatio Infinity, hardFailures présentes → REJECT', () => {
    const { credit } = engine();
    const out = credit.simulate({ amount:15000, termMonths:48, monthlyIncome:0, monthlyCharges:500, incomeType:'UNEMPLOYMENT', employmentStatus:'UNEMPLOYED', loanPurpose:'VEHICLE', existingCreditsMonthly:0, country:'BE' } as any);
    expect(out.eligibility.debtRatio).toBe(Infinity);
    expect(out.recommendation).toBe('REJECT_RECOMMENDATION');
  });

  it('charges > revenus → charges_vs_income hard + surendettement', () => {
    const { credit } = engine();
    const out = credit.simulate({ amount:10000, termMonths:36, monthlyIncome:2000, monthlyCharges:2100, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:0, country:'BE' });
    expect(out.eligibility.hardFailures.some(f=>f.rule==='charges_vs_income')).toBe(true);
    expect(out.eligibility.isEligible).toBe(false);
    expect(out.recommendation).toBe('REJECT_RECOMMENDATION');
  });

  it('charges = 90% revenus → pas hard, 91% → hard', () => {
    const { credit } = engine();
    const ok = credit.simulate({ amount:5000, termMonths:24, monthlyIncome:3000, monthlyCharges:2700, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE' });
    expect(ok.eligibility.hardFailures.some(f=>f.rule==='charges_vs_income')).toBe(false);
    const ko = credit.simulate({ amount:5000, termMonths:24, monthlyIncome:3000, monthlyCharges:2701, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE' });
    expect(ko.eligibility.hardFailures.some(f=>f.rule==='charges_vs_income')).toBe(true);
  });

  it('âge <18 → hard min_age, âge >75 → soft max_age', () => {
    const { credit } = engine();
    const minor = credit.simulate({ amount:5000, termMonths:24, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', birthDate:'2015-01-01' });
    expect(minor.eligibility.hardFailures.some(f=>f.rule==='min_age')).toBe(true);
    expect(minor.recommendation).toBe('REJECT_RECOMMENDATION');
    const senior = credit.simulate({ amount:5000, termMonths:24, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', birthDate:'1940-01-01' });
    expect(senior.eligibility.softFailures.some(f=>f.rule==='max_age')).toBe(true);
  });

  it('debtRatio 33-34% → soft max_debt_ratio, >55% → hard', () => {
    const { elig, rules } = engine();
    // craft simulation monthly ~400, charges 900, existing 250, income 3200 => ratio (400+900+250)/3200=48% soft+ soon hard? 48>33 soft <55 not hard
    const resSoft = elig.check({ amount:15000, termMonths:48, monthlyIncome:3200, monthlyCharges:900, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:250, country:'BE'} as any, { monthlyPayment:340 }, 'PERSONAL','BE');
    expect(resSoft.softFailures.some(f=>f.rule==='max_debt_ratio')).toBe(true);
    expect(resSoft.hardFailures.some(f=>f.rule==='max_debt_ratio_hard')).toBe(false);
    const resHard = elig.check({ amount:15000, termMonths:48, monthlyIncome:1800, monthlyCharges:800, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:400, country:'BE'} as any, { monthlyPayment:500 }, 'PERSONAL','BE');
    // (500+800+400)/1800=94% >55 hard
    expect(resHard.hardFailures.some(f=>f.rule==='max_debt_ratio_hard')).toBe(true);
  });

  it('configurable règle max_debt_ratio → 0.50 lève soft seulement au delà', () => {
    const { rules, credit } = engine();
    rules.__setRules([{ key:'max_debt_ratio', value:0.50, isHard:false, category:'eligibility', country:'BE'}]);
    const out = credit.simulate({ amount:15000, termMonths:48, monthlyIncome:3200, monthlyCharges:900, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:250, country:'BE' });
    // ratio ~48% <50 donc pas soft
    expect(out.eligibility.softFailures.some(f=>f.rule==='max_debt_ratio')).toBe(false);
  });

  it('maxAllowedAmount calculé si soft debtRatio mais eligible', () => {
    const { credit } = engine();
    // revenus 3800 pour que debt ~35% soft: (338+800+200)/3800=35% → allowed 3800*0.33 -1000=254 → maxAllowed >0
    const out = credit.simulate({ amount:15000, termMonths:48, monthlyIncome:3800, monthlyCharges:800, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:200, country:'BE' });
    expect(out.eligibility.debtRatio).toBeGreaterThan(0.33);
    expect(out.eligibility.debtRatio).toBeLessThan(0.55);
    expect(out.eligibility.isEligible).toBe(true);
    expect(out.eligibility.maxAllowedAmount).not.toBeNull();
    expect(out.eligibility.maxAllowedAmount!).toBeGreaterThan(0);
    expect(out.eligibility.maxAllowedAmount!).toBeLessThan(50000);
  });

  it('demande incomplète côté engine: termMonths manquant → lance via RateRule (NO_RATE_RULE) — validation DTO testée en API', () => {
    const { credit } = engine();
    expect(()=> (credit as any).simulate({ amount:10000, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE'}))
      .toThrow();
  });

  it('taux configurable via RulesService effectiveFrom ordering', () => {
    const { rules } = engine();
    rules.__setRateRules([
      { id:'old', country:'BE', product:'PERSONAL', minAmount:1500, maxAmount:10000, minTerm:12, maxTerm:60, baseRate:0.10, fees:{filePct:0}, effectiveFrom:'2020-01-01'},
      { id:'new', country:'BE', product:'PERSONAL', minAmount:1500, maxAmount:10000, minTerm:12, maxTerm:60, baseRate:0.02, fees:{filePct:0}, effectiveFrom:'2026-06-01'},
    ]);
    const rule = rules.getRateRule('BE','PERSONAL',5000,24);
    expect(rule!.id).toBe('new');
  });
});
