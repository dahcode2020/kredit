import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AUDITED_KEY, AuditedOptions } from '../decorators/audited.decorator';
import { AuditService } from '../audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector, private audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const opts = this.reflector.getAllAndOverride<AuditedOptions>(AUDITED_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!opts) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const actor = req.user ? (req.user.email || req.user.id || 'unknown') : (req.ip || 'anonymous');
    const actor_id = req.user?.id ?? req.user?.sub ?? null;
    const actor_type = req.user?.role ?? (req.user ? 'CUSTOMER' : 'ANONYMOUS');
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || null;
    const user_agent = req.headers['user-agent'] ?? null;
    const correlation_id = req.headers['x-request-id'] || req.headers['x-correlation-id'] || req.id || 'no-correlation';

    const entityIdFromReq = req.params?.id || req.params?.entityId || req.body?.id || req.body?.customerId || 'unknown';

    return next.handle().pipe(
      tap(async (result) => {
        try {
          const entityId = opts.entityId ? opts.entityId([req.params, req.body, req.query], result) : (result?.id || entityIdFromReq);
          await this.audit.log({
            actor: String(actor),
            actor_id,
            actor_type,
            action: opts.action,
            entity_type: opts.entityType,
            entity_id: String(entityId),
            before: opts.includeBeforeAfter ? req._audit_before : undefined,
            after: opts.includeBeforeAfter ? (result ?? req.body) : (result ? { id: entityId } : undefined),
            reason: req.body?.reason || req.body?.exceptionReason || undefined,
            ip,
            user_agent,
            correlation_id: String(correlation_id),
          });
        } catch (e) {
          // Audit failure ne doit jamais bloquer la requête métier, mais on log en security
          console.error('AuditInterceptor log failed', e);
        }
      }),
      catchError((err) => {
        // On pourrait logger l'échec aussi, mais on laisse remonter l'erreur métier
        throw err;
      }),
    );
  }
}
