import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ActorType, AuditAction, CreateAuditEntry, EntityType } from './entities/audit-log.entity';
import { redact, diffBeforeAfter, sanitizeReason } from './redaction.util';
import { CreateSecurityEntry } from './entities/security-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  // In-memory ring buffer for dev sans DB (remplacer par INSERT PG en prod)
  private memAudit: any[] = [];
  private memSecurity: any[] = [];
  private lastHash: string | null = null;
  private securityLastId = 0;

  // --- Helpers ---
  private hashPayload(prevHash: string | null, payload: string): string {
    return crypto.createHash('sha256').update((prevHash ?? '') + payload).digest('hex');
  }

  private newCorrelationId(): string {
    return crypto.randomUUID();
  }

  // --- Audit ---
  async log(entry: CreateAuditEntry): Promise<any> {
    const timestamp = new Date();
    const sanitizedBefore = entry.before ? redact(entry.before) : null;
    const sanitizedAfter = entry.after ? redact(entry.after) : null;
    // Si before/after fournis on peut ne garder que le diff pour limiter PII
    let before = sanitizedBefore;
    let after = sanitizedAfter;
    if (sanitizedBefore && sanitizedAfter) {
      const diff = diffBeforeAfter(sanitizedBefore, sanitizedAfter);
      // Pour investigation on garde diff, mais on log full redacted en metadata si besoin RGPD
      before = diff.before;
      after = diff.after;
    }

    const payloadObj = {
      actor: entry.actor,
      actor_id: entry.actor_id ?? null,
      actor_type: entry.actor_type,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      timestamp: timestamp.toISOString(),
      ip: entry.ip ?? null,
      user_agent: entry.user_agent ?? null,
      before,
      after,
      reason: sanitizeReason(entry.reason ?? undefined) ?? null,
      correlation_id: entry.correlation_id,
    };
    const payload = JSON.stringify(payloadObj);
    const hash = this.hashPayload(this.lastHash, payload);
    const record = {
      id: this.memAudit.length + 1,
      ...payloadObj,
      hash,
      prev_hash: this.lastHash,
      created_at: timestamp,
    };
    this.lastHash = hash;
    this.memAudit.push(record);
    // Garde max 10k en mémoire, sinon tronque
    if (this.memAudit.length > 10000) this.memAudit.shift();

    this.logger.log(`AUDIT ${entry.action} ${entry.entity_type}/${entry.entity_id} by ${entry.actor_type}:${entry.actor} corr=${entry.correlation_id} ip=${entry.ip}`);

    // Prod: INSERT INTO audit_logs (...) VALUES (...) — avec hash chaîné vérifiable
    // Ex: INSERT INTO audit_logs(actor, actor_id, actor_type, action, entity_type, entity_id, before, after, reason, ip, user_agent, correlation_id, hash, prev_hash, timestamp, created_at) VALUES (...)
    // + vérif en transaction: SELECT prev_hash ORDER BY id DESC FOR UPDATE

    return record;
  }

  // --- Security ---
  async logSecurity(entry: CreateSecurityEntry): Promise<any> {
    const record = {
      id: ++this.securityLastId,
      actor_id: entry.actor_id ?? null,
      actor_type: entry.actor_type ?? null,
      actor: entry.actor ?? null,
      event_type: entry.event_type,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.user_agent ?? null,
      metadata: entry.metadata ? redact(entry.metadata) : null,
      correlation_id: entry.correlation_id ?? null,
      severity: entry.severity ?? 'INFO',
      created_at: new Date(),
    };
    this.memSecurity.push(record);
    if (this.memSecurity.length > 10000) this.memSecurity.shift();

    const level = record.severity === 'CRITICAL' ? 'error' : record.severity === 'WARN' ? 'warn' : 'log';
    (this.logger as any)[level](`SECURITY ${record.event_type} ${record.actor ?? 'anonymous'} ip=${record.ip} corr=${record.correlation_id} severity=${record.severity}`);

    // Prod: INSERT INTO security_logs ...
    return record;
  }

  // --- Query & Investigation ---
  async findAudit(filters: { actor?: string; actor_type?: ActorType; action?: string; entity_type?: EntityType | string; entity_id?: string; ip?: string; correlation_id?: string; from?: Date; to?: Date; limit?: number; offset?: number }) {
    let res = [...this.memAudit].reverse(); // newest first
    if (filters.actor) res = res.filter(r => r.actor === filters.actor);
    if (filters.actor_type) res = res.filter(r => r.actor_type === filters.actor_type);
    if (filters.action) res = res.filter(r => r.action === filters.action);
    if (filters.entity_type) res = res.filter(r => r.entity_type === filters.entity_type);
    if (filters.entity_id) res = res.filter(r => r.entity_id === filters.entity_id);
    if (filters.ip) res = res.filter(r => r.ip === filters.ip);
    if (filters.correlation_id) res = res.filter(r => r.correlation_id === filters.correlation_id);
    if (filters.from) res = res.filter(r => new Date(r.timestamp) >= filters.from!);
    if (filters.to) res = res.filter(r => new Date(r.timestamp) <= filters.to!);
    const total = res.length;
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const data = res.slice(offset, offset + limit);
    return { data, total, limit, offset };
  }

  async findSecurity(filters: { event_type?: string; ip?: string; correlation_id?: string; severity?: string; from?: Date; to?: Date; limit?: number; offset?: number }) {
    let res = [...this.memSecurity].reverse();
    if (filters.event_type) res = res.filter(r => r.event_type === filters.event_type);
    if (filters.ip) res = res.filter(r => r.ip === filters.ip);
    if (filters.correlation_id) res = res.filter(r => r.correlation_id === filters.correlation_id);
    if (filters.severity) res = res.filter(r => r.severity === filters.severity);
    if (filters.from) res = res.filter(r => new Date(r.created_at) >= filters.from!);
    if (filters.to) res = res.filter(r => new Date(r.created_at) <= filters.to!);
    const total = res.length;
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const data = res.slice(offset, offset + limit);
    return { data, total, limit, offset };
  }

  async findByCorrelation(correlationId: string) {
    const audit = this.memAudit.filter(r => r.correlation_id === correlationId);
    const security = this.memSecurity.filter(r => r.correlation_id === correlationId);
    // Tri chronologique global
    const combined = [...audit.map(a => ({ source: 'AUDIT', ...a })), ...security.map(s => ({ source: 'SECURITY', timestamp: s.created_at, ...s }))].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return { correlation_id: correlationId, entries: combined };
  }

  async verifyChain(): Promise<{ valid: boolean; brokenAt?: number; expected?: string; got?: string }> {
    let prev: string | null = null;
    for (let i = 0; i < this.memAudit.length; i++) {
      const r = this.memAudit[i];
      const payloadObj = {
        actor: r.actor, actor_id: r.actor_id, actor_type: r.actor_type, action: r.action,
        entity_type: r.entity_type, entity_id: r.entity_id, timestamp: new Date(r.timestamp).toISOString(),
        ip: r.ip, user_agent: r.user_agent, before: r.before, after: r.after, reason: r.reason, correlation_id: r.correlation_id,
      };
      const expected = this.hashPayload(prev, JSON.stringify(payloadObj));
      if (expected !== r.hash) {
        return { valid: false, brokenAt: r.id, expected, got: r.hash };
      }
      prev = r.hash;
    }
    return { valid: true };
  }

  // --- Convenience helpers for every sensitive action ---
  async logAuth(action: AuditAction | string, ctx: { actor: string; actor_id?: string | null; actor_type: ActorType; ip?: string | null; user_agent?: string | null; correlation_id: string; before?: any; after?: any; reason?: string; entity_id?: string }) {
    return this.log({
      actor: ctx.actor, actor_id: ctx.actor_id ?? null, actor_type: ctx.actor_type, action,
      entity_type: 'USER', entity_id: ctx.entity_id ?? ctx.actor_id ?? ctx.actor,
      before: ctx.before, after: ctx.after, reason: ctx.reason,
      ip: ctx.ip ?? null, user_agent: ctx.user_agent ?? null, correlation_id: ctx.correlation_id,
    });
  }
}
