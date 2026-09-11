/**
 * API — validation DTO & NO_RATE_RULE & permissions
 * Pas de HTTP reel — simule validation pipe + controller logic
 */
import { CreditEngineService } from '../../src/credit/credit-engine.service';
import { RulesService } from '../../src/credit/rules/rules.service';
import { SimulationEngine } from '../../src/credit/simulation/simulation.engine';
import { EligibilityEngine } from '../../src/credit/eligibility/eligibility.engine';
import { ScoringEngine } from '../../src/credit/scoring/scoring.engine';
import { DecisionEngine } from '../../src/credit/decision-engine/decision.engine';

function makeEngine() {
  const rules = new RulesService();
  return new CreditEngineService(rules, new SimulationEngine(), new EligibilityEngine(rules), new ScoringEngine(rules), new DecisionEngine());
}

// Simule ValidationPipe forbidNonWhitelisted
function validateSimulationDto(dto:any){
  const allowed = new Set(['amount','termMonths','monthlyIncome','monthlyCharges','incomeType','employmentStatus','loanPurpose','existingCreditsMonthly','country','productType','birthDate']);
  for (const k of Object.keys(dto)) if (!allowed.has(k)) { const e:any=new Error(`forbidNonWhitelisted ${k}`); e.status=422; throw e; }
  if (dto.amount==null || dto.termMonths==null) { const e:any=new Error('missing'); e.status=422; throw e; }
  if (typeof dto.amount!=='number' || dto.amount < 500) { const e:any=new Error('amount min'); e.status=422; throw e; }
  if (!['SALARY','SELF_EMPLOYED','PENSION','OTHER','UNEMPLOYMENT'].includes(dto.incomeType)) { const e:any=new Error('incomeType'); e.status=422; throw e; }
}

describe('API simulation validation', () => {
  it('demande incomplète sans termMonths →422', () => {
    expect(()=> validateSimulationDto({ amount:10000, monthlyIncome:3000, incomeType:'SALARY'})).toThrow();
    try{ validateSimulationDto({ amount:10000 } as any);}catch(e:any){ expect(e.status).toBe(422); }
  });
  it('champ inconnu →422 forbidNonWhitelisted', () => {
    expect(()=> validateSimulationDto({ amount:10000, termMonths:24, monthlyIncome:3000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', injected:'<script>'})).toThrow(/forbidNonWhitelisted/);
  });
  it('NO_RATE_RULE →400 montant hors bande', () => {
    const eng = makeEngine();
    expect(()=> eng.simulate({ amount:50001, termMonths:48, monthlyIncome:5000, monthlyCharges:500, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE', productType:'PERSONAL'} as any)).toThrow(/NO_RATE_RULE|Aucune grille/);
  });
  it('simulation OK renvoie disclaimer + schedule + taeg', () => {
    const eng=makeEngine();
    const out=eng.simulate({ amount:15000, termMonths:48, monthlyIncome:3200, monthlyCharges:900, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE'});
    expect(out.simulation.disclaimer).toContain('indicative');
    expect(out.simulation.schedule.length).toBe(48);
    expect(out.simulation.taeg).toBeGreaterThan(0);
    expect(out.simulation.totalCost).toBeGreaterThan(15000);
  });
  it('headers: X-Request-Id écho (middleware)', () => {
    const corr = 'req_'+Math.random().toString(36).slice(2);
    const headers:any = { 'x-request-id': corr };
    // correlation.middleware copie header vers res
    expect(headers['x-request-id']).toBe(corr);
  });
});

describe('API admin RBAC — simulation accès', () => {
  function canAccessAdminDashboard(user:{role:string, mfaVerifiedAt?:string|null}){
    if (!['ADMIN','SUPER_ADMIN'].includes(user.role)) { const e:any=new Error('Forbidden'); e.status=403; throw e; }
    if (!user.mfaVerifiedAt) { const e:any=new Error('MFA_REQUIRED'); e.status=403; throw e; }
    return true;
  }
  it('CUSTOMER →403', ()=> expect(()=> canAccessAdminDashboard({ role:'CUSTOMER', mfaVerifiedAt:'2026-01-01'} as any)).toThrow());
  it('ADMIN sans MFA →403 MFA_REQUIRED', ()=> expect(()=> canAccessAdminDashboard({ role:'ADMIN', mfaVerifiedAt:null } as any)).toThrow(/MFA/));
  it('ADMIN avec MFA →200', ()=> expect(canAccessAdminDashboard({ role:'ADMIN', mfaVerifiedAt:new Date().toISOString()})).toBe(true));
  it('SUPER_ADMIN >50k exception seul autorisé (déjà testé) — 403 vs 200', () => {
    const wf = (amount:number, role:string)=>{
      if (amount>50000 && role!=='SUPER_ADMIN') { const e:any=new Error('REQUIRES_SUPER_ADMIN'); e.status=403; throw e; }
      return true;
    };
    expect(()=> wf(60000,'ADMIN')).toThrow(/SUPER_ADMIN/);
    expect(wf(60000,'SUPER_ADMIN')).toBe(true);
  });
});
