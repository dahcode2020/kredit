export type ActorType = 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN' | 'SYSTEM' | 'ANONYMOUS';
export type EntityType = 'USER' | 'KYC' | 'APPLICATION' | 'DOCUMENT' | 'DECISION' | 'RULE' | 'RATE_RULE' | 'PRODUCT' | 'INVESTMENT_PRODUCT' | 'PAYMENT' | 'REFUND' | 'ADMIN' | 'COUNTRY' | 'NOTIFICATION' | 'SESSION';
export type AuditAction =
  | 'auth.login' | 'auth.logout' | 'auth.register' | 'auth.refresh'
  | 'auth.password_change' | 'auth.email_change' | 'auth.phone_change'
  | 'auth.verify_email' | 'auth.verify_phone' | 'auth.mfa_enable' | 'auth.mfa_verify' | 'auth.mfa_disable'
  | 'customer.update' | 'customer.view'
  | 'document.upload' | 'document.view_sensitive' | 'document.delete' | 'document.presign'
  | 'application.create' | 'application.update' | 'application.submit' | 'application.status_change'
  | 'decision.approve' | 'decision.reject' | 'decision.exception' | 'decision.request_information'
  | 'rule.create' | 'rule.update' | 'rule.delete'
  | 'rate_rule.create' | 'rate_rule.update' | 'rate_rule.delete'
  | 'product.create' | 'product.update' | 'product.deactivate'
  | 'investment_product.create' | 'investment_product.update' | 'investment_product.status_change'
  | 'investment.subscribe' | 'investment.redeem'
  | 'payment.create' | 'payment.confirm' | 'payment.refund' | 'payment.reconcile'
  | 'admin.create' | 'admin.update' | 'admin.disable'
  | 'settings.update' | 'country.update' | 'notification.send' | 'notification.preference_update'
  | 'security.lockout' | 'security.rate_limited' | 'security.anomaly_detected';

export interface AuditLog {
  id: number; // BIGSERIAL
  actor: string; // actor identifier (email or id string) — redacted email domain? keep full for investigation but access restricted
  actor_id?: string | null; // UUID FK users.id
  actor_type: ActorType;
  action: AuditAction | string;
  entity_type: EntityType | string;
  entity_id: string;
  timestamp: Date; // alias created_at
  ip?: string | null; // INET
  user_agent?: string | null;
  before?: Record<string, any> | null; // JSONB redacted
  after?: Record<string, any> | null;
  reason?: string | null;
  correlation_id: string; // X-Request-Id
  hash: string; // sha256(prevHash + payload)
  prev_hash?: string | null;
  created_at: Date;
}

export interface CreateAuditEntry {
  actor: string;
  actor_id?: string | null;
  actor_type: ActorType;
  action: AuditAction | string;
  entity_type: EntityType | string;
  entity_id: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  reason?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  correlation_id: string;
}
