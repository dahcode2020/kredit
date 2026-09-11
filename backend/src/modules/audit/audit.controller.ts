import { Controller, Get, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireMFA } from '../../common/decorators/require-mfa.decorator';

@ApiTags('Audit')
@ApiBearerAuth('bearer')
@Roles('ADMIN', 'SUPER_ADMIN')
@RequireMFA()
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Recherche audit — investigation par actor, entity, correlation_id, IP (ADMIN/SUPER_ADMIN + MFA)', description: 'RBAC ADMIN/SUPER_ADMIN + MFA obligatoire. Pagination, filtres structurés, hash-chaîné vérifiable.' })
  @ApiQuery({ name: 'actor', required: false }) @ApiQuery({ name: 'actor_type', required: false }) @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'entity_type', required: false }) @ApiQuery({ name: 'entity_id', required: false }) @ApiQuery({ name: 'ip', required: false })
  @ApiQuery({ name: 'correlation_id', required: false }) @ApiQuery({ name: 'from', required: false }) @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false }) @ApiQuery({ name: 'offset', required: false })
  async list(
    @Query('actor') actor?: string, @Query('actor_type') actor_type?: any, @Query('action') action?: string,
    @Query('entity_type') entity_type?: any, @Query('entity_id') entity_id?: string, @Query('ip') ip?: string,
    @Query('correlation_id') correlation_id?: string, @Query('from') from?: string, @Query('to') to?: string,
    @Query('limit') limit?: string, @Query('offset') offset?: string,
  ) {
    return this.audit.findAudit({
      actor, actor_type, action, entity_type, entity_id, ip, correlation_id,
      from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : 50, offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('correlation/:id')
  @ApiOperation({ summary: 'Investigation par correlation_id — vue unifiée audit+security' })
  async byCorrelation(@Param('id') id: string) {
    return this.audit.findByCorrelation(id);
  }

  @Get('verify')
  @ApiOperation({ summary: 'Vérifie chaîne hash (intégrité append-only)', description: 'Parcourt audit_logs et recalcule SHA256(prev+payload). Doit être appelé quotidiennement et après restore.' })
  async verify() {
    return this.audit.verifyChain();
  }
}
