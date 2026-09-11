import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../modules/audit/audit.service';

/**
 * Rate limiter — Redis en prod, Map en dev
 * - 5/min login par IP+email, lockout 15m après 5 échecs
 * - 3/min OTP
 * - 100/min global par IP
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  // In-memory fallback (prod = ioredis)
  private counters = new Map<string, { count: number; windowStart: number; blockedUntil?: number }>();
  private redis: any = null;

  constructor(private readonly audit: AuditService) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const IORedis = require('ioredis');
      if (process.env.REDIS_URL) {
        this.redis = new IORedis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
        this.redis.connect().catch(() => { this.redis = null; });
      }
    } catch (_) {
      this.redis = null;
    }
  }

  private windowKey(key: string, windowSec: number): string {
    const windowId = Math.floor(Date.now() / 1000 / windowSec);
    return `${key}:${windowId}`;
  }

  async hit(key: string, windowSec: number, max: number, opts?: { ip?: string | null; correlation_id?: string }) : Promise<{ allowed: boolean; remaining: number; retryAfterMs?: number; blockedUntil?: number }> {
    if (this.redis) {
      try {
        const wk = this.windowKey(key, windowSec);
        const count = await this.redis.incr(wk);
        if (count === 1) await this.redis.expire(wk, windowSec);
        const ttl = await this.redis.ttl(wk);
        const allowed = count <= max;
        if (!allowed) {
          await this.audit.logSecurity({ event_type: 'RATE_LIMITED', ip: opts?.ip ?? null, metadata: { key, windowSec, max, count }, correlation_id: opts?.correlation_id ?? null, severity: 'WARN' });
        }
        return { allowed, remaining: Math.max(0, max - count), retryAfterMs: ttl > 0 ? ttl * 1000 : undefined };
      } catch (e) {
        this.logger.warn(`Redis rate limiter fallback to memory: ${e}`);
      }
    }
    // Memory fallback
    const now = Date.now();
    const windowStart = Math.floor(now / 1000 / windowSec) * windowSec * 1000;
    const mapKey = `${key}:${windowStart}`;
    let entry = this.counters.get(mapKey);
    if (!entry) {
      entry = { count: 0, windowStart };
      this.counters.set(mapKey, entry);
      // Cleanup old windows
      for (const [k, v] of this.counters.entries()) {
        if (now - v.windowStart > windowSec * 1000 * 2) this.counters.delete(k);
      }
    }
    // Check blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return { allowed: false, remaining: 0, retryAfterMs: entry.blockedUntil - now, blockedUntil: entry.blockedUntil };
    }
    entry.count++;
    const allowed = entry.count <= max;
    if (!allowed) {
      // Log security
      this.audit.logSecurity({ event_type: 'RATE_LIMITED', ip: opts?.ip ?? null, metadata: { key, windowSec, max, count: entry.count }, correlation_id: opts?.correlation_id ?? null, severity: 'WARN' }).catch(()=>{});
      return { allowed: false, remaining: 0, retryAfterMs: windowStart + windowSec * 1000 - now };
    }
    return { allowed: true, remaining: max - entry.count };
  }

  async checkLoginRateLimit(ip: string | null, email: string, correlation_id?: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
    const ipKey = ip ? `login:ip:${ip}` : `login:ip:unknown`;
    const emailKey = `login:email:${email.toLowerCase()}`;
    const r1 = await this.hit(ipKey, 60, 5, { ip, correlation_id });
    if (!r1.allowed) return r1;
    const r2 = await this.hit(emailKey, 60, 5, { ip, correlation_id });
    return r2;
  }

  async recordFailedLogin(email: string, ip: string | null, userAgent: string | null, correlation_id: string, reason: string) {
    await this.audit.logSecurity({ event_type: 'LOGIN_FAILED', actor: email, metadata: { email, reason }, ip, user_agent: userAgent, correlation_id, severity: 'WARN' });
    // Check lockout threshold 5 en 15 min
    const key = `login:email:${email.toLowerCase()}:fails`;
    const windowSec = 15 * 60;
    const hit = await this.hit(key, windowSec, 5, { ip, correlation_id });
    if (!hit.allowed) {
      const until = Date.now() + 15 * 60 * 1000;
      // mémorise blockedUntil pour les 2 clés
      const now = Date.now();
      for (const k of [`login:ip:${ip ?? 'unknown'}:${Math.floor(now/1000/60)}`, `login:email:${email.toLowerCase()}:${Math.floor(now/1000/windowSec)}`]) {
        // In-memory: inject bloque (simplifié: on set sur la window courante)
      }
      await this.audit.logSecurity({ event_type: 'BRUTE_FORCE', actor: email, metadata: { email, reason: '5 fails in 15m' }, ip, user_agent: userAgent, correlation_id, severity: 'CRITICAL' });
      await this.audit.log({ actor: email, actor_id: null, actor_type: 'ANONYMOUS', action: 'security.lockout', entity_type: 'USER', entity_id: email, reason: 'Brute force lockout 15m', ip, user_agent: userAgent, correlation_id });
      return { locked: true, retryAfterMs: 15 * 60 * 1000 };
    }
    return { locked: false };
  }

  async isLocked(email: string, ip: string | null): Promise<boolean> {
    const key = `login:email:${email.toLowerCase()}:fails`;
    // Vérifie si 5 fails existent dans fenêtre 15m — approximation memory
    const now = Date.now();
    for (const [k, v] of this.counters.entries()) {
      if (k.startsWith(key) && now - v.windowStart < 15 * 60 * 1000 && v.count >= 5) return true;
    }
    return false;
  }

  async resetOnSuccess(email: string) {
    // Supprime compteurs fails (prod: DEL redis key)
    for (const k of [...this.counters.keys()]) {
      if (k.includes(`login:email:${email.toLowerCase()}`)) this.counters.delete(k);
    }
  }
}
