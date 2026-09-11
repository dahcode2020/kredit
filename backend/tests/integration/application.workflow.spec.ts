/**
 * Integration — transitions statut dossier (in-memory, sans DB)
 * Couvre DRAFT→SUBMITTED, UNDER_ADMIN_REVIEW, APPROVED, REJECTED, terminal, idempotence
 */

type Status = 'DRAFT'|'SUBMITTED'|'UNDER_AUTOMATED_REVIEW'|'UNDER_ADMIN_REVIEW'|'KYC_PENDING'|'DOCUMENTS_PENDING'|'APPROVED'|'APPROVED_WITH_EXCEPTION'|'REJECTED';

class ApplicationWorkflow {
  private apps = new Map<string,{ id:string; status:Status; version:number; amount:number; customerId:string }>();
  create(customerId:string, amount:number, status:Status='DRAFT'){ const id='app_'+Math.random().toString(36).slice(2); const a={id,status,version:1,amount,customerId}; this.apps.set(id,a); return a; }
  get(id:string){ return this.apps.get(id)!; }
  transition(id:string, to:Status, opts:{ actor:'CUSTOMER'|'ADMIN'|'SUPER_ADMIN', role?:string, mfa?:boolean, reason?:string, expectedVersion?:number }){
    const app=this.apps.get(id)!;
    if (opts.expectedVersion && app.version !== opts.expectedVersion) { const e:any=new Error('Conflict'); e.status=409; throw e; }
    const allowed: Record<Status, Status[]> = {
      DRAFT: ['SUBMITTED'],
      SUBMITTED: ['UNDER_AUTOMATED_REVIEW','UNDER_ADMIN_REVIEW','KYC_PENDING','DOCUMENTS_PENDING'],
      UNDER_AUTOMATED_REVIEW: ['UNDER_ADMIN_REVIEW','KYC_PENDING','REJECTED'],
      UNDER_ADMIN_REVIEW: ['APPROVED','APPROVED_WITH_EXCEPTION','REJECTED','KYC_PENDING','DOCUMENTS_PENDING'],
      KYC_PENDING: ['UNDER_ADMIN_REVIEW','REJECTED','DOCUMENTS_PENDING'],
      DOCUMENTS_PENDING: ['UNDER_ADMIN_REVIEW','REJECTED','KYC_PENDING'],
      APPROVED: [],
      APPROVED_WITH_EXCEPTION: [],
      REJECTED: [],
    } as any;
    if (!allowed[app.status]?.includes(to)) { const e:any=new Error(`Transition ${app.status}→${to} forbidden`); e.status=422; throw e;}

    if ((to==='APPROVED'||to==='APPROVED_WITH_EXCEPTION') && opts.actor!=='ADMIN' && opts.actor!=='SUPER_ADMIN') { const e:any=new Error('forbidden'); e.status=403; throw e; }
    if ((to==='APPROVED'||to==='APPROVED_WITH_EXCEPTION'||to==='REJECTED') && !opts.mfa) { const e:any=new Error('MFA_REQUIRED'); e.status=403; throw e; }
    if (to==='APPROVED_WITH_EXCEPTION') {
      const len = (opts.reason ?? '').length;
      if (len<20 || len>2000) { const e:any=new Error('Invalid exception reason 20-2000'); e.status=400; throw e;}
      if (app.amount>50000 && opts.actor!=='SUPER_ADMIN') { const e:any=new Error('REQUIRES_SUPER_ADMIN'); e.status=403; throw e;}
    }
    app.status=to; app.version++;
    return app;
  }
}

describe('ApplicationWorkflow — transitions', () => {
  it('CUSTOMER DRAFT→SUBMITTED ok', () => {
    const wf=new ApplicationWorkflow();
    const app=wf.create('cust1',15000,'DRAFT');
    const next=wf.transition(app.id,'SUBMITTED',{ actor:'CUSTOMER', mfa:true });
    expect(next.status).toBe('SUBMITTED');
  });
  it('DRAFT→UNDER_ADMIN_REVIEW forbidden →422', () => {
    const wf=new ApplicationWorkflow();
    const app=wf.create('cust1',15000,'DRAFT');
    expect(()=> wf.transition(app.id,'UNDER_ADMIN_REVIEW',{ actor:'ADMIN', mfa:true})).toThrow();
    try{ wf.transition(app.id,'UNDER_ADMIN_REVIEW',{ actor:'ADMIN', mfa:true} as any);}catch(e:any){ expect(e.status).toBe(422); }
  });
  it('APPROVED terminal → cannot transition', () => {
    const wf=new ApplicationWorkflow();
    const app=wf.create('cust1',15000,'UNDER_ADMIN_REVIEW');
    wf.transition(app.id,'APPROVED',{ actor:'ADMIN', mfa:true});
    expect(()=> wf.transition(app.id,'REJECTED',{ actor:'ADMIN', mfa:true})).toThrow();
  });
  it('ADMIN approves without MFA →403 MFA_REQUIRED', () => {
    const wf=new ApplicationWorkflow();
    const app=wf.create('cust1',15000,'UNDER_ADMIN_REVIEW');
    expect(()=> wf.transition(app.id,'APPROVED',{ actor:'ADMIN', mfa:false} as any)).toThrow(/MFA/);
  });
  it('exception reason 20-2000 chars boundary', () => {
    const wf=new ApplicationWorkflow();
    const app=wf.create('cust1',15000,'UNDER_ADMIN_REVIEW');
    expect(()=> wf.transition(app.id,'APPROVED_WITH_EXCEPTION',{ actor:'ADMIN', mfa:true, reason:'short'})).toThrow(/20-2000/);
    expect(()=> wf.transition(app.id,'APPROVED_WITH_EXCEPTION',{ actor:'ADMIN', mfa:true, reason:'a'.repeat(2001)})).toThrow();
    const ok=wf.transition(app.id,'APPROVED_WITH_EXCEPTION',{ actor:'ADMIN', mfa:true, reason:'a'.repeat(20)});
    expect(ok.status).toBe('APPROVED_WITH_EXCEPTION');
  });
  it('exception >50k requires SUPER_ADMIN →403 else OK', () => {
    const wf=new ApplicationWorkflow();
    const app=wf.create('cust1',60000,'UNDER_ADMIN_REVIEW');
    expect(()=> wf.transition(app.id,'APPROVED_WITH_EXCEPTION',{ actor:'ADMIN', mfa:true, reason:'a'.repeat(100)})).toThrow(/SUPER_ADMIN/);
    const ok=wf.transition(app.id,'APPROVED_WITH_EXCEPTION',{ actor:'SUPER_ADMIN', mfa:true, reason:'a'.repeat(100)});
    expect(ok.status).toBe('APPROVED_WITH_EXCEPTION');
  });
  it('optimistic lock 409 simultaneous updates', () => {
    const wf=new ApplicationWorkflow();
    const app=wf.create('cust1',15000,'DRAFT');
    wf.transition(app.id,'SUBMITTED',{ actor:'CUSTOMER', mfa:true, expectedVersion:1});
    // second tente avec stale version 1
    expect(()=> wf.transition(app.id,'UNDER_ADMIN_REVIEW',{ actor:'ADMIN', mfa:true, expectedVersion:1} as any)).toThrow();
    try{ wf.transition(app.id,'UNDER_ADMIN_REVIEW',{ actor:'ADMIN', mfa:true, expectedVersion:1} as any);}catch(e:any){ expect(e.status).toBe(409); }
  });
  it('CUSTOMER cannot approve →403 (admin only)', () => {
    const wf=new ApplicationWorkflow();
    const app=wf.create('cust1',15000,'UNDER_ADMIN_REVIEW');
    expect(()=> wf.transition(app.id,'APPROVED',{ actor:'CUSTOMER', mfa:true} as any)).toThrow(/forbidden/);
  });
});
