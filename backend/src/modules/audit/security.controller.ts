import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireMFA } from '../../common/decorators/require-mfa.decorator';

@ApiTags('Security')
@ApiBearerAuth('bearer')
@Roles('SUPER_ADMIN')
@RequireMFA()
@Controller('admin/security-logs')
export class SecurityController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Journaux sécurité — brute force, anomalies, MFA, lockout (SUPER_ADMIN)', description: 'Filtrage par event_type, IP, severity. Jamais de secret en clair.' })
  async list(
    @Query('event_type') event_type?: string, @Query('ip') ip?: string, @Query('correlation_id') correlation_id?: string,
    @Query('severity') severity?: string, @Query('from') from?: string, @Query('to') to?: string,
    @Query('limit') limit?: string, @Query('offset') offset?: string,
  ) {
    return this.audit.findSecurity({
      event_type, ip, correlation_id, severity,
      from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : 50, offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
