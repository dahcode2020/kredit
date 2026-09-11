import { ActorType, EntityType } from './audit-log.entity';

export type SecurityEventType =
  | 'LOGIN_FAILED' | 'LOGIN_SUCCESS' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'EMAIL_CHANGE' | 'PHONE_CHANGE'
  | 'BRUTE_FORCE' | 'RATE_LIMITED' | 'ANOMALY_VELOCITY' | 'ANOMALY_IMPOSSIBLE_TRAVEL' | 'ANOMALY_DEVICE_CHANGE'
  | 'MFA_FAILED' | 'MFA_SUCCESS' | 'LOCKOUT' | 'UNLOCK' | 'SECRET_ROTATED' | 'BACKUP_CREATED' | 'RESTORE_TESTED';

export interface SecurityLog {
  id: number;
  actor_id?: string | null;
  actor_type?: ActorType | null;
  actor?: string | null;
  event_type: SecurityEventType | string;
  entity_type?: EntityType | string | null;
  entity_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any> | null; // redacted
  correlation_id?: string | null;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  created_at: Date;
}

export interface CreateSecurityEntry {
  actor_id?: string | null;
  actor_type?: ActorType | null;
  actor?: string | null;
  event_type: SecurityEventType | string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, any> | null;
  correlation_id?: string | null;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
}
