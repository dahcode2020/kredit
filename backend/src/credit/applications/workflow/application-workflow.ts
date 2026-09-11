import { ApplicationStatus } from './application-status.enum';

export type ActorRole = 'CUSTOMER' | 'SYSTEM' | 'ADMIN' | 'SUPER_ADMIN';

export interface TransitionDef {
  to: ApplicationStatus;
  allowedRoles: ActorRole[];
  requiresReason?: boolean;
  requiresExceptionReason?: boolean;
  requiresSuperAdminIfAmountOver?: number; // threshold
  event: string; // business event name
  auditAction: string;
}

// Matrice complète — source of truth, jamais en dur ailleurs
export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, TransitionDef[]> = {
  [ApplicationStatus.DRAFT]: [
    { to: ApplicationStatus.SUBMITTED, allowedRoles: ['CUSTOMER'], event: 'application.submitted', auditAction: 'application.submit' },
    { to: ApplicationStatus.CANCELLED, allowedRoles: ['CUSTOMER'], requiresReason: true, event: 'application.cancelled', auditAction: 'application.cancel' },
  ],
  [ApplicationStatus.SUBMITTED]: [
    { to: ApplicationStatus.KYC_PENDING, allowedRoles: ['SYSTEM'], event: 'kyc.started', auditAction: 'kyc.start' },
  ],
  [ApplicationStatus.KYC_PENDING]: [
    { to: ApplicationStatus.DOCUMENTS_PENDING, allowedRoles: ['SYSTEM'], event: 'kyc.verified', auditAction: 'kyc.verify' },
    { to: ApplicationStatus.REJECTED, allowedRoles: ['SYSTEM'], requiresReason: true, event: 'kyc.rejected', auditAction: 'kyc.reject' }, // seul REJECT auto autorisé (hard KYC)
    { to: ApplicationStatus.MORE_INFORMATION_REQUIRED, allowedRoles: ['SYSTEM','ADMIN'], requiresReason: true, event: 'more_info.requested', auditAction: 'kyc.more_info' },
  ],
  [ApplicationStatus.DOCUMENTS_PENDING]: [
    { to: ApplicationStatus.UNDER_AUTOMATED_REVIEW, allowedRoles: ['SYSTEM'], event: 'automated_review.started', auditAction: 'documents.verified' },
    { to: ApplicationStatus.MORE_INFORMATION_REQUIRED, allowedRoles: ['SYSTEM','ADMIN'], requiresReason: true, event: 'more_info.requested', auditAction: 'documents.more_info' },
  ],
  [ApplicationStatus.UNDER_AUTOMATED_REVIEW]: [
    { to: ApplicationStatus.UNDER_ADMIN_REVIEW, allowedRoles: ['SYSTEM'], event: 'admin_review.started', auditAction: 'automated_review.complete' },
  ],
  [ApplicationStatus.UNDER_ADMIN_REVIEW]: [
    { to: ApplicationStatus.APPROVED, allowedRoles: ['ADMIN','SUPER_ADMIN'], event: 'application.approved', auditAction: 'admin.decide' },
    { to: ApplicationStatus.APPROVED_WITH_EXCEPTION, allowedRoles: ['ADMIN','SUPER_ADMIN'], requiresExceptionReason: true, requiresSuperAdminIfAmountOver: 50000, event: 'application.approved_with_exception', auditAction: 'admin.decide_exception' },
    { to: ApplicationStatus.REJECTED, allowedRoles: ['ADMIN','SUPER_ADMIN'], requiresReason: true, event: 'application.rejected', auditAction: 'admin.decide_reject' },
    { to: ApplicationStatus.MORE_INFORMATION_REQUIRED, allowedRoles: ['ADMIN','SUPER_ADMIN'], requiresReason: true, event: 'more_info.requested', auditAction: 'admin.more_info' },
  ],
  [ApplicationStatus.MORE_INFORMATION_REQUIRED]: [
    { to: ApplicationStatus.DOCUMENTS_PENDING, allowedRoles: ['CUSTOMER'], event: 'documents.uploaded', auditAction: 'document.upload' },
    { to: ApplicationStatus.KYC_PENDING, allowedRoles: ['CUSTOMER','SYSTEM'], event: 'kyc.started', auditAction: 'kyc.restart' },
    { to: ApplicationStatus.CANCELLED, allowedRoles: ['CUSTOMER'], requiresReason: true, event: 'application.cancelled', auditAction: 'application.cancel' },
  ],
  [ApplicationStatus.APPROVED]: [
    { to: ApplicationStatus.CONTRACT_PENDING, allowedRoles: ['SYSTEM'], event: 'contract.created', auditAction: 'contract.create' },
  ],
  [ApplicationStatus.APPROVED_WITH_EXCEPTION]: [
    { to: ApplicationStatus.CONTRACT_PENDING, allowedRoles: ['SYSTEM'], event: 'contract.created', auditAction: 'contract.create' },
  ],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.CONTRACT_PENDING]: [
    { to: ApplicationStatus.CONTRACT_SIGNED, allowedRoles: ['CUSTOMER'], event: 'contract.signed', auditAction: 'contract.sign' },
    { to: ApplicationStatus.CANCELLED, allowedRoles: ['CUSTOMER'], requiresReason: true, event: 'application.cancelled', auditAction: 'application.cancel' },
  ],
  [ApplicationStatus.CONTRACT_SIGNED]: [
    { to: ApplicationStatus.DISBURSEMENT_PENDING, allowedRoles: ['SYSTEM'], event: 'disbursement.initiated', auditAction: 'disbursement.initiate' },
  ],
  [ApplicationStatus.DISBURSEMENT_PENDING]: [
    { to: ApplicationStatus.DISBURSED, allowedRoles: ['SYSTEM'], event: 'disbursement.completed', auditAction: 'disbursement.complete' },
  ],
  [ApplicationStatus.DISBURSED]: [
    { to: ApplicationStatus.CLOSED, allowedRoles: ['SYSTEM'], event: 'application.closed', auditAction: 'application.close' },
  ],
  [ApplicationStatus.CLOSED]: [],
  [ApplicationStatus.CANCELLED]: [],
};

export function findTransition(from: ApplicationStatus, to: ApplicationStatus): TransitionDef | undefined {
  return (ALLOWED_TRANSITIONS[from] ?? []).find(t => t.to === to);
}
