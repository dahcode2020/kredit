import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_MFA_KEY } from '../decorators/require-mfa.decorator';

@Injectable()
export class MfaGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const requireMfa = this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!requireMfa) return true;
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Authentication required for MFA-protected route');
    // ADMIN/SUPER_ADMIN must have mfa_verified_at within 5 min or mfa_enabled
    if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      if (!user.mfaEnabled && !user.mfa_enabled) throw new ForbiddenException('MFA_REQUIRED: activez TOTP');
      const verifiedAt = user.mfaVerifiedAt || user.mfa_verified_at;
      if (!verifiedAt) throw new ForbiddenException('MFA_REQUIRED: vérifiez votre TOTP');
      const age = Date.now() - new Date(verifiedAt).getTime();
      if (age > 5 * 60 * 1000) throw new ForbiddenException('MFA_EXPIRED: re-vérifiez TOTP');
    }
    return true;
  }
}
