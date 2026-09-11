import { Controller, Get, Post, Param, Body, Query, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RequestInfoDto { @ApiProperty() @IsString() @MinLength(10) reason!: string; @ApiProperty({ required: false }) @IsOptional() documents?: string[]; }
class ApproveDto { @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string; }
class ApproveExceptionDto { @ApiProperty() @IsString() @MinLength(20) exceptionReason!: string; @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string; }
class RejectDto { @ApiProperty() @IsString() @MinLength(10) reason!: string; }

@ApiTags('Admin')
@ApiBearerAuth('bearer')
@Controller('admin')
export class AdminController {
  @Get('dashboard')
  @ApiOperation({ summary: 'Métriques', description: 'ADMIN/SUPER_ADMIN + MFA' })
  async dashboard() { return { clients: 8400, demandes: 12700, enAttente: 42, aExaminer: 12 }; }

  @Get('customers')
  async customers(@Query('search') _s?: string, @Query('page') page = 1) {
    return { data: [{ id: 'cust_1', name: 'Alex Martin', kyc: 'VERIFIED' }], meta: { total: 1, page: Number(page), limit: 20 } };
  }

  @Get('customers/:id')
  async customerOne(@Param('id') id: string) { return { id, name: 'Alex Martin', kyc: { status: 'VERIFIED' } }; }

  @Get('credit-applications')
  async listApps(@Query('status') _s?: string, @Query('page') page = 1) {
    return { data: [{ id: 'KRD-2026-0842', amount: 15000, status: 'UNDER_ADMIN_REVIEW' }], meta: { total: 1, page: Number(page), limit: 20 } };
  }

  @Get('credit-applications/:id')
  async getApp(@Param('id') id: string) {
    return { id, status: 'UNDER_ADMIN_REVIEW', simulation: { monthly: 338.62 }, score: { value: 62 }, rules: { passed: [], failed: [{ key: 'max_debt_ratio', value: 0.384 }] } };
  }

  @Post('credit-applications/:id/request-information')
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  async requestInfo(@Param('id') id: string, @Body() dto: RequestInfoDto) {
    return { id, status: 'MORE_INFORMATION_REQUIRED', reason: dto.reason };
  }

  @Post('credit-applications/:id/approve')
  @ApiHeader({ name: 'X-Idempotency-Key', required: true }) @ApiResponse({ status: 200 }) @ApiResponse({ status: 409 })
  async approve(@Param('id') id: string, @Body() dto: ApproveDto) { return { id, status: 'APPROVED', auditHash: 'a3f9...' }; }

  @Post('credit-applications/:id/approve-with-exception')
  @ApiHeader({ name: 'X-Idempotency-Key', required: true }) @ApiResponse({ status: 403, description: 'REQUIRES_SUPER_ADMIN if amount>50000' })
  async approveEx(@Param('id') id: string, @Body() dto: ApproveExceptionDto) {
    if (!dto.exceptionReason || dto.exceptionReason.length < 20) return { statusCode: 400, code: 'MISSING_EXCEPTION_REASON' };
    return { id, status: 'APPROVED_WITH_EXCEPTION', exceptionReason: dto.exceptionReason, auditHash: 'a3f9...' };
  }

  @Post('credit-applications/:id/reject')
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  async reject(@Param('id') id: string, @Body() dto: RejectDto) { return { id, status: 'REJECTED', reason: dto.reason }; }

  @Get('loans') async loans() { return { data: [{ id: 'loan_1', principal: 15000 }], meta: { total: 1 } }; }
  @Get('payments') async payments() { return { data: [{ id: 'pay_1', amount: 463, status: 'SUCCEEDED', provider: 'mollie' }], meta: { total: 1 } }; }
  @Get('investments') async investments() { return { totalSubscribers: 1200, totalAmount: 8200000 }; }
  @Get('audit-logs') async audit(@Query('entity') _e?: string) { return { data: [{ id: 1, actor: 'admin@kredit.be', action: 'admin.approve', hash: 'a3f9...' }], meta: { total: 1 } }; }
}
