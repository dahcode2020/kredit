import { RulesService } from '../../src/credit/rules/rules.service';
import { ScoringEngine } from '../../src/credit/scoring/scoring.engine';
import { DecisionEngine } from '../../src/credit/decision-engine/decision.engine';

describe('scoring & decision', () => {
  const rules = new RulesService();
  const scoring = new ScoringEngine(rules);
  const decision = new DecisionEngine();

  function scoreCase(input: any, debt: number, product='PERSONAL') {
    return scoring.score(input, debt, product);
  }

  it('grade A ≥80 (CDI, SALARY, VEHICLE, debt <33, court terme)', () => {
    const s = scoreCase({ incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', termMonths:12 }, 0.25);
    expect(s.grade).toBe('A');
    expect(s.value).toBeGreaterThanOrEqual(80);
  });

  it('UNEMPLOYED + DEBT_CONSOLIDATION + long terme → E', () => {
    const s = scoreCase({ incomeType:'UNEMPLOYMENT', employmentStatus:'UNEMPLOYED', loanPurpose:'DEBT_CONSOLIDATION', termMonths:84 }, 0.60);
    expect(s.grade).toBe('E');
    expect(s.value).toBeLessThan(25);
  });

  it('weights configurables via RulesService', () => {
    rules.__setRules([{ key:'scoring_weights', value:{ debtRatio:10, incomeStability:10, employment:10, purpose:10, term:60}, isHard:false, category:'scoring'}]);
    const customScoring = new ScoringEngine(rules);
    const s = customScoring.score({ incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', termMonths:12 } as any, 0.25, 'PERSONAL');
    expect(s.value).toBeGreaterThan(50);
    // restore
    rules.__setRules([{ key:'scoring_weights', value:{ debtRatio:35, incomeStability:25, employment:20, purpose:10, term:10}, isHard:false, category:'scoring'}]);
  });

  it('CDD/INDEPENDENT vs CDI: pondération employment', () => {
    const cdi = scoreCase({ incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', termMonths:24 }, 0.30);
    const cdd = scoreCase({ incomeType:'SALARY', employmentStatus:'CDD', loanPurpose:'VEHICLE', termMonths:24 }, 0.30);
    const interim = scoreCase({ incomeType:'SALARY', employmentStatus:'INTERIM', loanPurpose:'VEHICLE', termMonths:24 }, 0.30);
    expect(cdi.breakdown.employment).toBeGreaterThan(cdd.breakdown.employment);
    expect(cdd.breakdown.employment).toBeGreaterThan(interim.breakdown.employment);
  });

  it('term ratio: MORTGAGE 300 max, PERSONAL 84', () => {
    const shortMort = scoreCase({ incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', termMonths:60 } as any, 0.2, 'MORTGAGE');
    const longMort = scoreCase({ incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', termMonths:300 } as any, 0.2, 'MORTGAGE');
    expect(shortMort.breakdown.term).toBeGreaterThan(longMort.breakdown.term);
  });

  describe('decision matrix', () => {
    it('REJECT si hardFailures ou grade E ou debt>50', () => {
      expect(decision.recommend({ isEligible:false, hardFailures:[{rule:'x', message:'y', isHard:true}], softFailures:[], debtRatio:0.2, repaymentCapacity:1000, maxAllowedAmount:null } as any, { grade:'A', value:85 } as any)).toBe('REJECT_RECOMMENDATION');
      expect(decision.recommend({ isEligible:true, hardFailures:[], softFailures:[], debtRatio:0.2, repaymentCapacity:1000, maxAllowedAmount:null } as any, { grade:'E', value:10 } as any)).toBe('REJECT_RECOMMENDATION');
      expect(decision.recommend({ isEligible:true, hardFailures:[], softFailures:[], debtRatio:0.60, repaymentCapacity:1000, maxAllowedAmount:null } as any, { grade:'B', value:70 } as any)).toBe('REJECT_RECOMMENDATION');
    });
    it('REVIEW si C/D ou softFailures ou debt>33', () => {
      expect(decision.recommend({ isEligible:true, hardFailures:[], softFailures:[], debtRatio:0.20, repaymentCapacity:1000, maxAllowedAmount:null } as any, { grade:'C', value:50 } as any)).toBe('REVIEW_RECOMMENDATION');
      expect(decision.recommend({ isEligible:true, hardFailures:[], softFailures:[{rule:'max_debt_ratio', message:'', isHard:false}], debtRatio:0.20, repaymentCapacity:1000, maxAllowedAmount:null } as any, { grade:'B', value:70 } as any)).toBe('REVIEW_RECOMMENDATION');
      expect(decision.recommend({ isEligible:true, hardFailures:[], softFailures:[], debtRatio:0.40, repaymentCapacity:1000, maxAllowedAmount:null } as any, { grade:'B', value:70 } as any)).toBe('REVIEW_RECOMMENDATION');
    });
    it('APPROVE si A/B + debt≤33 + capacity>500 sans failure', () => {
      expect(decision.recommend({ isEligible:true, hardFailures:[], softFailures:[], debtRatio:0.30, repaymentCapacity:600, maxAllowedAmount:null } as any, { grade:'A', value:85 } as any)).toBe('APPROVE_RECOMMENDATION');
      expect(decision.recommend({ isEligible:true, hardFailures:[], softFailures:[], debtRatio:0.30, repaymentCapacity:501, maxAllowedAmount:null } as any, { grade:'B', value:70 } as any)).toBe('APPROVE_RECOMMENDATION');
    });
  });

  it('ADMIN reste final decision — recommendation ne bypass pas workflow (workflow test séparé)', () => {
    // guarantee that credit engine never returns finalized status APPROVED — only RECOMMENDATION
    // final APPROVED requires ADMIN transition tested in workflow.spec
    const r = decision.recommend({ isEligible:true, hardFailures:[], softFailures:[], debtRatio:0.1, repaymentCapacity:2000, maxAllowedAmount:null } as any, { grade:'A', value:90 } as any);
    expect(r).toMatch(/RECOMMENDATION/);
    expect(r).not.toBe('APPROVED');
  });
});
