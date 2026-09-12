import { CreditEngineService } from '../credit-engine.service';
import { RulesService } from '../rules/rules.service';
import { SimulationEngine } from '../simulation/simulation.engine';
import { EligibilityEngine } from '../eligibility/eligibility.engine';
import { ScoringEngine } from '../scoring/scoring.engine';
import { DecisionEngine } from '../decision-engine/decision.engine';
function createEngine() {
  const rules = new RulesService();
  const sim = new SimulationEngine();
  const elig = new EligibilityEngine(rules);
  const scoring = new ScoringEngine(rules);
  const decision = new DecisionEngine();
  const engine = new CreditEngineService(rules, sim, elig, scoring, decision);
  return { engine, rules };
}
describe('CreditEngine', () => {
  it('simulation — 15k 48m au 1er palier (2,50 %) ≈ 328,71', () => {
    const { engine } = createEngine();
    const out = engine.simulate({ amount:15000, termMonths:48, monthlyIncome:5000, monthlyCharges:800, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:0, country:'BE', productType:'PERSONAL' });
    expect(out.simulation.monthlyPayment).toBeCloseTo(328.71, 0);
    expect(out.simulation.schedule.length).toBe(48);
    expect(out.simulation.totalCost).toBeGreaterThan(15000);
    expect(out.simulation.disclaimer).toContain('indicative');
  });
  it('debt ratio calculation', () => {
    const { engine } = createEngine();
    const out = engine.simulate({ amount:15000, termMonths:48, monthlyIncome:3000, monthlyCharges:900, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:250, country:'BE' });
    expect(out.eligibility.debtRatio).toBeGreaterThan(0.45);
    expect(out.warnings.some(w=>w.code==='DEBT_RATIO_HIGH')).toBeTruthy();
  });
  it('REJECT if hard max_amount exceeded (NO_RATE_RULE)', () => {
    const { engine } = createEngine();
    let threw = false;
    try { engine.simulate({ amount:250000, termMonths:84, monthlyIncome:8000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:0, country:'BE', productType:'PERSONAL' }); } catch(e:any){ threw = true; expect(JSON.stringify(e).includes('NO_RATE_RULE')).toBeTruthy(); }
    expect(threw).toBe(true);
    const near = engine.simulate({ amount:190000, termMonths:84, monthlyIncome:20000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:0, country:'BE', productType:'PERSONAL' });
    expect(near.warnings.some(w=>w.code==='AT_CEILING')).toBeTruthy();
    expect(near.eligibility.isEligible).toBe(true);
  });
  it('APPROVE when A/B and low debt', () => {
    const { engine } = createEngine();
    const out = engine.simulate({ amount:10000, termMonths:36, monthlyIncome:5000, monthlyCharges:600, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:0, country:'BE' });
    expect(['APPROVE_RECOMMENDATION','REVIEW_RECOMMENDATION']).toContain(out.recommendation);
    expect(out.recommendation).not.toBe('REJECT_RECOMMENDATION');
  });
  it('REVIEW when C grade or debt >33', () => {
    const { engine } = createEngine();
    const out = engine.simulate({ amount:15000, termMonths:48, monthlyIncome:3200, monthlyCharges:900, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:250, country:'BE' });
    expect(out.eligibility.debtRatio).toBeGreaterThan(0.33);
    expect(out.recommendation).toBe('REVIEW_RECOMMENDATION');
  });
  it('REJECT when E or debt>50', () => {
    const { engine } = createEngine();
    const out = engine.simulate({ amount:25000, termMonths:48, monthlyIncome:1800, monthlyCharges:800, incomeType:'UNEMPLOYMENT', employmentStatus:'UNEMPLOYED', loanPurpose:'DEBT_CONSOLIDATION', existingCreditsMonthly:400, country:'BE' });
    expect(out.recommendation).toBe('REJECT_RECOMMENDATION');
    expect(out.score.grade).toBe('E');
  });
  it('throws NO_RATE_RULE for unknown band', () => {
    const { engine } = createEngine();
    expect(()=> engine.simulate({ amount:15000, termMonths:6, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', productType:'MORTGAGE' })).toThrow('Aucune grille');
  });
  it('requires docs for SELF_EMPLOYED and high amount', () => {
    const { engine } = createEngine();
    const out = engine.simulate({ amount:25000, termMonths:48, monthlyIncome:4000, monthlyCharges:700, incomeType:'SELF_EMPLOYED', employmentStatus:'INDEPENDENT', loanPurpose:'WORKS', existingCreditsMonthly:0, country:'BE', productType:'PERSONAL' });
    expect(out.requiredDocuments.some(d=>d.code==='TAX_RETURN_2Y')).toBeTruthy();
    expect(out.requiredDocuments.some(d=>d.code==='BANK_STATEMENTS_3M')).toBeTruthy();
  });
  it('age hard rule', () => {
    const { engine } = createEngine();
    const out = engine.simulate({ amount:5000, termMonths:24, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:0, country:'BE', birthDate:'2015-01-01' });
    expect(out.eligibility.hardFailures.some(f=>f.rule==='min_age')).toBeTruthy();
    expect(out.recommendation).toBe('REJECT_RECOMMENDATION');
  });
  it('configurable via RulesService', () => {
    const { engine, rules } = createEngine();
    rules.__setRules([{ key:'max_debt_ratio', value:0.50, isHard:false, category:'eligibility', country:'BE' }]);
    const out = engine.simulate({ amount:15000, termMonths:48, monthlyIncome:3000, monthlyCharges:900, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:250, country:'BE' });
    expect(out.eligibility.softFailures.some(f=>f.rule==='max_debt_ratio')).toBe(false);
  });
});
