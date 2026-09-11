/**
 * Événements métier — publiés après chaque transition (après commit)
 * Consommés par BullMQ workers (KYC, scoring, notifications, contract, disbursement)
 */
export const ApplicationEvents = {
  SUBMITTED: 'application.submitted',
  KYC_STARTED: 'kyc.started',
  KYC_VERIFIED: 'kyc.verified',
  KYC_REJECTED: 'kyc.rejected',
  DOCUMENTS_UPLOADED: 'documents.uploaded',
  DOCUMENTS_VERIFIED: 'documents.verified',
  AUTOMATED_REVIEW_STARTED: 'automated_review.started',
  AUTOMATED_REVIEW_COMPLETED: 'automated_review.completed',
  ADMIN_REVIEW_STARTED: 'admin_review.started',
  APPROVED: 'application.approved',
  APPROVED_WITH_EXCEPTION: 'application.approved_with_exception',
  REJECTED: 'application.rejected',
  MORE_INFO_REQUESTED: 'more_info.requested',
  CONTRACT_CREATED: 'contract.created',
  CONTRACT_SIGNED: 'contract.signed',
  DISBURSEMENT_INITIATED: 'disbursement.initiated',
  DISBURSEMENT_COMPLETED: 'disbursement.completed',
  CLOSED: 'application.closed',
  CANCELLED: 'application.cancelled',
} as const;

export interface BusinessEvent<T = any> {
  type: string; // ApplicationEvents value
  applicationId: string;
  actorId: string | null;
  actorRole: string;
  country: string;
  correlationId: string; // requestId
  occurredAt: string;
  payload: T;
}
