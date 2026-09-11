import { Controller, Post, Get, Put, Delete, Param, Body, Query, Req, Headers, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SimDto {
  @ApiProperty({ example: 15000 }) @IsNumber() amount!: number;
  @ApiProperty({ example: 48 }) @IsNumber() termMonths!: number;
  @ApiProperty() @IsNumber() monthlyIncome!: number;
  @ApiProperty() @IsNumber() monthlyCharges!: number;
  @ApiProperty({ enum: ['SALARY','SELF_EMPLOYED','PENSION'] }) @IsEnum(['SALARY','SELF_EMPLOYED','PENSION']) incomeType!: string;
  @ApiProperty({ enum: ['CDI','CDD','INDEPENDENT'] }) @IsEnum(['CDI','CDD','INDEPENDENT']) employmentStatus!: string;
  @ApiProperty({ enum: ['VEHICLE','WORKS','CONSUMPTION'] }) @IsEnum(['VEHICLE','WORKS','CONSUMPTION']) loanPurpose!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() existingCreditsMonthly?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() country?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() productType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() birthDate?: string;
}
class AppDto {
  @ApiProperty() @IsString() simulationId!: string;
  @ApiProperty() @IsNumber() amount!: number;
  @ApiProperty() @IsNumber() termMonths!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() purpose?: string;
  @ApiProperty() @IsString() productType!: string;
  @ApiProperty() @IsString() country!: string;
}

@ApiTags('Credit')
@Controller('credit')
export class CreditController {
  @Post('simulations')
  @ApiOperation({ summary: 'Simuler (sans auth, cache 60s, Simulation ≠ offre)', description: 'Validation montants/plafonds, audit non' })
  @ApiResponse({ status: 201 }) @ApiResponse({ status: 422 })
  @HttpCode(201)
  async sim(@Body() dto: SimDto) {
    return { id: 'sim_9c1e', simulation: { monthlyPayment: 338.62, annualRate: 0.0421, taeg: 0.0421, totalInterest: 1414, fees: { file: 150 }, totalCost: 16414, schedule: [], disclaimer: 'Simulation ≠ offre', meta: { country: 'BE', product: 'PERSONAL', rateRuleId: 'rate_BE_PERSONAL_10001_25000', generatedAt: new Date().toISOString() } }, eligibility: { isEligible: true, debtRatio: 0.384, repaymentCapacity: 1711 }, score: { value: 62, grade: 'C' }, recommendation: 'REVIEW_RECOMMENDATION' };
  }

  @Get('simulations/:id')
  @ApiOperation({ summary: 'Récupérer simulation' })
  async getSim(@Param('id') id: string) { return { id, simulation: { monthlyPayment: 338.62 } }; }

  @Post('applications')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Créer dossier', description: 'Idempotence X-Idempotency-Key, audit' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  @ApiResponse({ status: 201 }) @ApiResponse({ status: 422 }) @ApiResponse({ status: 409 })
  @HttpCode(201)
  async createApp(@Body() dto: AppDto, @Headers('x-idempotency-key') _k?: string) {
    return { id: 'KRD-2026-0842', status: 'DRAFT', simulationId: dto.simulationId, createdAt: new Date().toISOString() };
  }

  @Get('applications')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Mes dossiers' })
  @ApiQuery({ name: 'status', required: false }) @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  async listApps(@Query('status') _s?: string, @Query('page') page = 1, @Query('limit') limit = 20) {
    return { data: [{ id: 'KRD-2026-0842', status: 'DRAFT', amount: 15000, term: 48 }], meta: { total: 1, page: Number(page), limit: Number(limit) } };
  }

  @Get('applications/:id')
  @ApiBearerAuth('bearer') async getApp(@Param('id') id: string) {
    return { id, status: 'DRAFT', amount: 15000, simulation: {}, eligibility: {}, score: {}, history: [] };
  }

  @Put('applications/:id')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Modifier DRAFT', description: 'Idempotence, audit' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  async updateApp(@Param('id') id: string, @Body() body: any) { return { id, ...body, updatedAt: new Date().toISOString() }; }

  @Post('applications/:id/documents')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Upload pièce', description: 'MIME pdf/jpg/png 10MB, ClamAV' })
  async uploadDoc(@Param('id') id: string) { return { documentId: 'doc_9c1e', code: 'ID', status: 'PENDING', s3Key: 's3://...' }; }

  @Delete('applications/:id/documents')
  @ApiBearerAuth('bearer') @HttpCode(204)
  async deleteDoc(@Param('id') id: string) { return; }

  @Get('applications/:id/status')
  @ApiBearerAuth('bearer') async getStatus(@Param('id') id: string) { return { status: 'KYC_PENDING', kycStatus: 'VERIFIED', compliance: { blocked: false, reasons: [] } }; }

  @Get('applications/:id/schedule')
  @ApiBearerAuth('bearer') async getSchedule(@Param('id') id: string) { return { schedule: [{ month: 1, payment: 338.62, interest: 50, principal: 288.62, balance: 14711 }], total: 16414, monthly: 338.62, taeg: 0.0421 }; }
}
