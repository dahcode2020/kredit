import { SetMetadata } from '@nestjs/common';
import { AuditAction, EntityType } from '../entities/audit-log.entity';

export const AUDITED_KEY = 'audited';
export interface AuditedOptions {
  action: AuditAction | string;
  entityType: EntityType | string;
  /** Spécifie comment extraire entityId des args (param, body, result). Par défaut params.id || body.id || result.id */
  entityId?: (args: any[], result?: any) => string;
  /** Entités sensibles où before/after doit être redacted diff uniquement */
  includeBeforeAfter?: boolean;
}

export const Audited = (opts: AuditedOptions) => SetMetadata(AUDITED_KEY, opts);
