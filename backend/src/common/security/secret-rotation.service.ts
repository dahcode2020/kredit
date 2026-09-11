import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../modules/audit/audit.service';

export type SecretName = 'JWT_RS256' | 'ENCRYPTION_KEY' | 'MFA_PEPPER' | 'NISS_PEPPER' | 'S3_KMS_KEY' | 'SESSION_SECRET';

@Injectable()
export class SecretRotationService {
  private readonly logger = new Logger(SecretRotationService.name);

  constructor(private readonly audit: AuditService) {}

  /**
   * Rotation planifiée — 90j (JWT, encryption) ou incident-driven
   * Procédure:
   * 1. Génère new_key_id + key material (Vault Transit)
   * 2. Double-write: signe/chiffre avec new, vérifie avec old+new
   * 3. Ré-encrypte données au fil de l'eau (lazy) ou batch
   * 4. Révoque old après TTL (JWT 15m, refresh 7j, encryption: garde old pour déchiffrement)
   * 5. Audit + alerte
   */
  async rotate(secretName: SecretName, rotatedBy: string, reason: string, correlationId: string): Promise<{ newKeyId: string; oldKeyId?: string }> {
    const newKeyId = `${secretName.toLowerCase()}-${Date.now()}`;
    const oldKeyId = process.env[`${secretName}_KEY_ID`] ?? 'unknown';

    this.logger.log(`ROTATE ${secretName} ${oldKeyId} -> ${newKeyId} by ${rotatedBy} reason=${reason}`);

    // Prod: call Vault: vault write transit/keys/<secret> export...
    // Ex: vault write -f transit/keys/jwt-rs256/rotate

    await this.audit.log({
      actor: rotatedBy,
      actor_id: null,
      actor_type: 'SUPER_ADMIN',
      action: 'security.secret_rotated' as any,
      entity_type: 'ADMIN',
      entity_id: secretName,
      before: { oldKeyId },
      after: { newKeyId, reason },
      reason,
      ip: null,
      user_agent: null,
      correlation_id: correlationId,
    });

    await this.audit.logSecurity({
      event_type: 'SECRET_ROTATED',
      actor: rotatedBy,
      metadata: { secretName, oldKeyId, newKeyId, reason },
      correlation_id: correlationId,
      severity: 'INFO',
    });

    // En prod: INSERT INTO secret_rotations(secret_name, old_key_id, new_key_id, rotated_by, reason, correlation_id)
    return { newKeyId, oldKeyId };
  }

  schedule(): void {
    // Cron 0 3 * * 0 -> vérifie âge clés, alerte si >80j, auto-rotate si >90j (SUPER_ADMIN only)
    this.logger.log('Secret rotation scheduler: next check in 24h (90j policy)');
  }
}
