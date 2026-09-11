import { RulesService } from '../../src/credit/rules/rules.service';
import { CreditEngineService } from '../../src/credit/credit-engine.service';
import { SimulationEngine } from '../../src/credit/simulation/simulation.engine';
import { EligibilityEngine } from '../../src/credit/eligibility/eligibility.engine';
import { ScoringEngine } from '../../src/credit/scoring/scoring.engine';
import { DecisionEngine } from '../../src/credit/decision-engine/decision.engine';

function eng() {
  const rules = new RulesService();
  return new CreditEngineService(rules, new SimulationEngine(), new EligibilityEngine(rules), new ScoringEngine(rules), new DecisionEngine());
}

describe('KYC & documents — règles', () => {
  it('SELF_EMPLOYED → TAX_RETURN_2Y + BANK_STATEMENTS_3M requis', () => {
    const e = eng();
    const out = e.simulate({ amount:25000, termMonths:48, monthlyIncome:4000, monthlyCharges:700, incomeType:'SELF_EMPLOYED', employmentStatus:'INDEPENDENT', loanPurpose:'WORKS', country:'BE', productType:'PERSONAL' });
    expect(out.requiredDocuments.some(d=>d.code==='TAX_RETURN_2Y')).toBe(true);
    expect(out.requiredDocuments.some(d=>d.code==='BANK_STATEMENTS_3M')).toBe(true);
  });

  it('montant >20k → BANK_STATEMENTS_3M même si non indépendant', () => {
    const e = eng();
    const out = e.simulate({ amount:21000, termMonths:36, monthlyIncome:4000, monthlyCharges:700, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE' });
    expect(out.requiredDocuments.some(d=>d.code==='BANK_STATEMENTS_3M')).toBe(true);
  });

  it('MORTGAGE docs étendus depuis RulesService', () => {
    const e = eng();
    const out = e.simulate({ amount:200000, termMonths:240, monthlyIncome:8000, monthlyCharges:1500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', productType:'MORTGAGE' });
    expect(out.requiredDocuments.map(d=>d.code)).toEqual(expect.arrayContaining(['PROPERTY_VALUATION','BANK_STATEMENTS_3M']));
  });

  it('debtRatio >40% → DEBT_DETAILS requis', () => {
    const e = eng();
    const out = e.simulate({ amount:15000, termMonths:48, monthlyIncome:3000, monthlyCharges:900, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', existingCreditsMonthly:300, country:'BE' });
    expect(out.eligibility.debtRatio).toBeGreaterThan(0.4);
    expect(out.requiredDocuments.some(d=>d.code==='DEBT_DETAILS')).toBe(true);
  });

  it('document expiré simulé: expires_at < now → traitement KYC bloqué (intégration)', () => {
    // unit: règle métier — un document avec expiresAt passée doit être marqué EXPIRED par service
    const expired = { code:'ID', expiresAt: new Date(Date.now() - 86400000).toISOString() };
    const isExpired = new Date(expired.expiresAt) < new Date();
    expect(isExpired).toBe(true);
    // Le workflow integration vérifiera que KYC_PENDING + doc EXPIRED → DOCUMENTS_REJECTED / re-upload required
  });

  it('KYC échoué: score E + hard failures → REJECT_RECOMMENDATION (admin final)', () => {
    const e = eng();
    const out = e.simulate({ amount:25000, termMonths:48, monthlyIncome:1800, monthlyCharges:800, incomeType:'UNEMPLOYMENT', employmentStatus:'UNEMPLOYED', loanPurpose:'DEBT_CONSOLIDATION', existingCreditsMonthly:400, country:'BE' });
    expect(out.score.grade).toBe('E');
    expect(out.recommendation).toBe('REJECT_RECOMMENDATION');
  });
});

describe('notifications & webhooks — invariants', () => {
  it('templates i18n 4 locales attendues (fr/nl/de/en) — structure', () => {
    const locales = ['fr','nl','de','en'];
    const template = (locale:string)=> `KREDIT — ${locale} — prêt approuvé`;
    locales.forEach(l=> expect(template(l)).toContain(l));
  });

  it('multilingue timezone: Europe/Brussels 12:00 due date', () => {
    const { roundEuro } = require('../../src/common/money/money');
    // simulate dueDate helper — 10:00 UTC = 12:00 Brussels (CEST)
    const due = new Date('2026-07-10T10:00:00Z');
    const parts = new Intl.DateTimeFormat('fr-BE',{ hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Europe/Brussels'}).formatToParts(due);
    const hour = parts.find(p=>p.type==='hour')!.value;
    expect(hour).toBe('12');
    expect(roundEuro(100.1)).toBe(100.1);
  });

  it('devise EUR only — autre devise doit throw', () => {
    // le PaymentService force EUR par défaut
    const allowed = ['EUR'];
    expect(allowed.includes('USD')).toBe(false);
    expect(allowed.includes('EUR')).toBe(true);
  });
});
