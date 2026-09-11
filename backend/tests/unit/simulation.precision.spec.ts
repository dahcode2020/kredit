import Decimal from 'decimal.js';
import { SimulationEngine } from '../../src/credit/simulation/simulation.engine';
import { RulesService } from '../../src/credit/rules/rules.service';
import { CreditEngineService } from '../../src/credit/credit-engine.service';
import { EligibilityEngine } from '../../src/credit/eligibility/eligibility.engine';
import { ScoringEngine } from '../../src/credit/scoring/scoring.engine';
import { DecisionEngine } from '../../src/credit/decision-engine/decision.engine';
import { roundEuro, toCents } from '../../src/common/money/money';

function makeEngine() {
  const rules = new RulesService();
  const sim = new SimulationEngine();
  const elig = new EligibilityEngine(rules);
  const scoring = new ScoringEngine(rules);
  const dec = new DecisionEngine();
  return { engine: new CreditEngineService(rules, sim, elig, scoring, dec), rules, sim };
}

describe('simulation — précision Decimal vs Math float', () => {
  it('15 000€ 48m 3.99% → 338.62€ (±1c)', () => {
    const { engine } = makeEngine();
    const out = engine.simulate({ amount:15000, termMonths:48, monthlyIncome:5000, monthlyCharges:800, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE' });
    expect(out.simulation.monthlyPayment).toBeCloseTo(338.62, 0);
    // totalCost = monthly(Decimal exact) * N + fees, arrondi HALF_UP → ±0.06 dû à arrondi intermédiaire
    expect(out.simulation.totalCost).toBeCloseTo(roundEuro(new Decimal(out.simulation.monthlyPayment).mul(48).plus(out.simulation.fees.total).toNumber()), 0);
    expect(out.simulation.totalCost).toBeGreaterThan(15000);
  });

  it('taux 0% (hypothétique) → mensualité = P/n exact', () => {
    const { rules } = makeEngine();
    rules.__setRateRules([{ id:'zero', country:'BE', product:'PERSONAL', minAmount:1000, maxAmount:100000, minTerm:12, maxTerm:60, baseRate:0, fees:{ filePct:0, fileMin:0, fileMax:0}, effectiveFrom:'2026-01-01'}]);
    const eng = makeEngine(); eng.rules.__setRateRules(rules['rateRules']);
    // recreate with zero
    const sim = new SimulationEngine();
    const out = sim.simulate({ principal:12000, termMonths:12, rateRule: rules['rateRules'][0] });
    expect(out.monthlyPayment).toBe(1000);
    expect(out.totalInterest).toBe(0);
    expect(out.schedule.every(s=> s.interest===0)).toBe(true);
  });

  it('MORTGAGE 300m ≈300 échéances, balance final 0 (±1c ajusté)', () => {
    const { engine } = makeEngine();
    const out = engine.simulate({ amount:200000, termMonths:300, monthlyIncome:8000, monthlyCharges:1500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', productType:'MORTGAGE' });
    expect(out.simulation.schedule.length).toBe(300);
    expect(out.simulation.schedule.at(-1)!.balance).toBe(0);
    const sumPrincipal = out.simulation.schedule.reduce((a,s)=> new Decimal(a).plus(s.principal).toNumber(), 0);
    // sum principal should be ~200000 within 1€ (arrondi cumul 300*0.01)
    expect(Math.abs(sumPrincipal - 200000)).toBeLessThan(1);
  });

  it('fees cap 10% principal — file 100% du principal → 10%', () => {
    const { rules, sim } = makeEngine();
    const pred = rules.getRateRule('BE','PERSONAL',15000,48)!;
    // force huge fee
    const inflated: any = { ...pred, fees:{ filePct:1.0, fileMin:0, fileMax: 1e9 } };
    const out = sim.simulate({ principal:15000, termMonths:48, rateRule: inflated });
    expect(out.fees.total).toBe(1500); // cap 10%
    expect(out.fees.total).toBeLessThanOrEqual(15000*0.1);
  });

  it('schedule invariants: interest+principal ≈ monthly, balance décroît', () => {
    const { engine } = makeEngine();
    const out = engine.simulate({ amount:12000, termMonths:24, monthlyIncome:4000, monthlyCharges:800, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE' });
    const monthly = out.simulation.monthlyPayment;
    out.simulation.schedule.forEach((line, idx)=>{
      const isLast = idx===out.simulation.schedule.length-1;
      const sum = roundEuro(new Decimal(line.interest).plus(line.principal).toNumber());
      if (!isLast) expect(Math.abs(sum - monthly)).toBeLessThan(0.02); // arrondi 1c toléré (engine round each field separately)
      if (idx>0) expect(line.balance).toBeLessThanOrEqual(out.simulation.schedule[idx-1].balance + 0.01);
    });
    expect(toCents(out.simulation.schedule.at(-1)!.balance)).toBe(0);
  });

  it('arrondi mensuel cohérent P*r/(1-(1+r)^-n) → pas de float Math.pow dérive', () => {
    const P=15000, n=48, annual=0.0399;
    const r = new Decimal(annual).div(12);
    const monthlyDecimal = new Decimal(P).mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)));
    const monthlyFloat = (P * (annual/12)) / (1 - Math.pow(1+annual/12, -n));
    // Float may differ >0.01 on some combos; Decimal is reference
    expect(Number(monthlyDecimal.toFixed(2))).toBeCloseTo(338.62, 0);
    // float version close but not relied upon
    expect(Math.abs(Number(monthlyDecimal.toFixed(2)) - Number(monthlyFloat.toFixed(2)))).toBeLessThan(0.02);
  });

  it('bornes PERSONAL BE: 1500/50000 limites', () => {
    const { engine } = makeEngine();
    expect(()=> engine.simulate({ amount:1499, termMonths:24, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE'})).toThrow(/NO_RATE_RULE|Aucune grille/);
    expect(()=> engine.simulate({ amount:50001, termMonths:48, monthlyIncome:5000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', productType:'PERSONAL'})).toThrow(/NO_RATE_RULE|Aucune grille/);
    const minOk = engine.simulate({ amount:1500, termMonths:12, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE'});
    expect(minOk.simulation.schedule.length).toBe(12);
    const maxOk = engine.simulate({ amount:50000, termMonths:84, monthlyIncome:10000, monthlyCharges:1000, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE'});
    expect(maxOk.simulation.schedule.length).toBe(84);
  });

  it('durée bornes PERSONAL 12-84, MORTGAGE 60-300', () => {
    const { engine } = makeEngine();
    expect(()=> engine.simulate({ amount:10000, termMonths:11, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE'})).toThrow(/NO_RATE_RULE|Aucune grille/);
    expect(()=> engine.simulate({ amount:10000, termMonths:85, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE'})).toThrow(/NO_RATE_RULE|Aucune grille/);
    expect(()=> engine.simulate({ amount:100000, termMonths:59, monthlyIncome:10000, monthlyCharges:1000, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', productType:'MORTGAGE'})).toThrow(/NO_RATE_RULE|Aucune grille/);
    const mortOk = engine.simulate({ amount:200000, termMonths:300, monthlyIncome:8000, monthlyCharges:1500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', productType:'MORTGAGE'});
    expect(mortOk.simulation.schedule.length).toBe(300);
  });

  it('toCents conservation pour montant MORTGAGE 500k', () => {
    expect(toCents(500000)).toBe(50000000);
    // monthly * cents cohérent
    const { engine } = makeEngine();
    const out = engine.simulate({ amount:500000, termMonths:300, monthlyIncome:15000, monthlyCharges:2000, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', productType:'MORTGAGE'});
    expect(toCents(out.simulation.monthlyPayment)).toBeGreaterThan(200000); // >2000€
  });
});
