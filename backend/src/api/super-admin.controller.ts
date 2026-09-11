import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RuleDto {
  @ApiProperty() @IsString() product_type!: string;
  @ApiProperty() @IsString() country_code!: string;
  @ApiProperty() @IsString() key!: string;
  @ApiProperty() value!: any;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() is_hard?: boolean;
}
class RateRuleDto {
  @ApiProperty() @IsString() product_type!: string;
  @ApiProperty() @IsString() country_code!: string;
  @ApiProperty() @IsNumber() min_amount!: number;
  @ApiProperty() @IsNumber() max_amount!: number;
  @ApiProperty() @IsNumber() min_term!: number;
  @ApiProperty() @IsNumber() max_term!: number;
  @ApiProperty() @IsNumber() base_rate!: number;
}
class AdminDto {
  @ApiProperty() @IsString() email!: string;
  @ApiProperty({ enum: ['ADMIN','SUPER_ADMIN'] }) @IsEnum(['ADMIN','SUPER_ADMIN']) role!: string;
  @ApiProperty() @IsString() tempPassword!: string;
}

@ApiTags('Super Admin')
@ApiBearerAuth('bearer')
@Controller('admin')
export class SuperAdminController {
  @Get('settings') @ApiOperation({ summary: 'Params globaux' }) async getSettings() { return { countries: [{ code: 'BE', locales: ['fr','nl','de'] }], locales: ['fr','en','nl','de'] }; }
  @Put('settings') async putSettings(@Body() body: any) { return { updated: true, ...body }; }

  @Get('rules') async listRules() { return { data: [{ id: 'rule_1', key: 'max_debt_ratio', value: 0.33 }], meta: { total: 1 } }; }
  @Post('rules') async createRule(@Body() dto: RuleDto) { return { id: 'rule_2', ...dto }; }
  @Put('rules/:id') async updateRule(@Param('id') id: string, @Body() dto: any) { return { id, ...dto, version: 2 }; }

  @Get('rate-rules') async listRates() { return { data: [{ id: 'rate_1', product_type: 'PERSONAL', base_rate: 0.0421 }], meta: { total: 1 } }; }
  @Post('rate-rules') async createRate(@Body() dto: RateRuleDto) { return { id: 'rate_2', ...dto }; }
  @Put('rate-rules/:id') async updateRate(@Param('id') id: string, @Body() dto: any) { return { id, ...dto }; }

  @Get('administrators') async listAdmins() { return { data: [{ id: 'adm_1', email: 'admin@kredit.be', role: 'ADMIN' }], meta: { total: 1 } }; }
  @Post('administrators') async createAdmin(@Body() dto: AdminDto) { return { id: 'adm_2', email: dto.email, role: dto.role }; }
  @Put('administrators/:id') async updateAdmin(@Param('id') id: string, @Body() dto: any) { return { id, ...dto }; }
}
