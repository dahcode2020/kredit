import { ApplicationWorkflowService } from '../workflow/application-workflow.service';
import { ApplicationStatus } from '../workflow/application-status.enum';

function svc() { return new ApplicationWorkflowService(); }

describe('ApplicationWorkflow', () => {
  it('DRAFT → SUBMITTED allowed for CUSTOMER', () => {
    const r = svc().transition({ applicationId:'a1', from:ApplicationStatus.DRAFT, to:ApplicationStatus.SUBMITTED, actorId:'c1', actorRole:'CUSTOMER', amount:15000, history:[ApplicationStatus.DRAFT] });
    expect(r.event).toBe('application.submitted');
  });

  it('DRAFT → UNDER_ADMIN_REVIEW bypass forbidden', () => {
    expect(()=> svc().transition({ applicationId:'a1', from:ApplicationStatus.DRAFT, to:ApplicationStatus.UNDER_ADMIN_REVIEW, actorId:'c1', actorRole:'CUSTOMER', amount:15000, history:[ApplicationStatus.DRAFT] }))
      .toThrow('interdite');
  });

  it('UNDER_AUTOMATED_REVIEW requires KYC + DOCS history', () => {
    expect(()=> svc().transition({ applicationId:'a1', from:ApplicationStatus.DOCUMENTS_PENDING, to:ApplicationStatus.UNDER_AUTOMATED_REVIEW, actorId:null, actorRole:'SYSTEM', amount:15000, history:[ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED] }))
      .toThrow('Contournement');
  });

  it('APPROVED_WITH_EXCEPTION requires exceptionReason 20-2000', () => {
    try { svc().transition({ applicationId:'a1', from:ApplicationStatus.UNDER_ADMIN_REVIEW, to:ApplicationStatus.APPROVED_WITH_EXCEPTION, actorId:'adm', actorRole:'ADMIN', amount:15000, reason:null, exceptionReason:'', history:[ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.KYC_PENDING, ApplicationStatus.DOCUMENTS_PENDING, ApplicationStatus.UNDER_AUTOMATED_REVIEW, ApplicationStatus.UNDER_ADMIN_REVIEW] }); expect(true).toBe(false); } catch(e:any){ expect(JSON.stringify(e.getResponse ? e.getResponse() : e.message)).toContain('MISSING_EXCEPTION_REASON'); }
    try { svc().transition({ applicationId:'a1', from:ApplicationStatus.UNDER_ADMIN_REVIEW, to:ApplicationStatus.APPROVED_WITH_EXCEPTION, actorId:'adm', actorRole:'ADMIN', amount:15000, exceptionReason:'trop court', history:[ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.KYC_PENDING, ApplicationStatus.DOCUMENTS_PENDING, ApplicationStatus.UNDER_AUTOMATED_REVIEW, ApplicationStatus.UNDER_ADMIN_REVIEW] }); expect(true).toBe(false); } catch(e:any){ expect(JSON.stringify(e.getResponse ? e.getResponse() : e.message)).toContain('INVALID_EXCEPTION_REASON'); }
  });

  it('APPROVED_WITH_EXCEPTION >50k requires SUPER_ADMIN', () => {
    expect(()=> svc().transition({ applicationId:'a1', from:ApplicationStatus.UNDER_ADMIN_REVIEW, to:ApplicationStatus.APPROVED_WITH_EXCEPTION, actorId:'adm', actorRole:'ADMIN', amount:60000, exceptionReason:'Client historique 10 ans avec garanties hypothécaires complémentaires et revenus stables', history:[ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.KYC_PENDING, ApplicationStatus.DOCUMENTS_PENDING, ApplicationStatus.UNDER_AUTOMATED_REVIEW, ApplicationStatus.UNDER_ADMIN_REVIEW] }))
      .toThrow('SUPER_ADMIN');
    const ok = svc().transition({ applicationId:'a1', from:ApplicationStatus.UNDER_ADMIN_REVIEW, to:ApplicationStatus.APPROVED_WITH_EXCEPTION, actorId:'sup', actorRole:'SUPER_ADMIN', amount:60000, exceptionReason:'Client historique 10 ans avec garanties hypothécaires complémentaires et revenus stables', history:[ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.KYC_PENDING, ApplicationStatus.DOCUMENTS_PENDING, ApplicationStatus.UNDER_AUTOMATED_REVIEW, ApplicationStatus.UNDER_ADMIN_REVIEW] });
    expect(ok.to).toBe(ApplicationStatus.APPROVED_WITH_EXCEPTION);
  });

  it('REJECTED terminal — no outgoing', () => {
    expect(()=> svc().transition({ applicationId:'a1', from:ApplicationStatus.REJECTED, to:ApplicationStatus.CLOSED, actorId:null, actorRole:'SYSTEM', amount:15000, history:[ApplicationStatus.REJECTED] }))
      .toThrow('terminal');
  });

  it('KYC_PENDING → REJECTED allowed only for SYSTEM hard KYC', () => {
    const r = svc().transition({ applicationId:'a1', from:ApplicationStatus.KYC_PENDING, to:ApplicationStatus.REJECTED, actorId:null, actorRole:'SYSTEM', amount:15000, reason:'Fraude documentaire', history:[ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.KYC_PENDING] });
    expect(r.event).toBe('kyc.rejected');
    expect(()=> svc().transition({ applicationId:'a1', from:ApplicationStatus.KYC_PENDING, to:ApplicationStatus.REJECTED, actorId:'adm', actorRole:'ADMIN', amount:15000, reason:'x', history:[ApplicationStatus.KYC_PENDING] }))
      .toThrow('non autorisé');
  });

  it('history + audit built', () => {
    const r = svc().transition({ applicationId:'app-1', from:ApplicationStatus.UNDER_ADMIN_REVIEW, to:ApplicationStatus.APPROVED, actorId:'adm-1', actorRole:'ADMIN', amount:15000, history:[ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.KYC_PENDING, ApplicationStatus.DOCUMENTS_PENDING, ApplicationStatus.UNDER_AUTOMATED_REVIEW, ApplicationStatus.UNDER_ADMIN_REVIEW] });
    expect(r.historyRow.applicationId).toBe('app-1');
    expect(r.auditLog.action).toBe('admin.decide');
    expect(r.auditLog.before.status).toBe('UNDER_ADMIN_REVIEW');
  });
});
