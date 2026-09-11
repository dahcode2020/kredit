import { Controller, Post, Get, Param, Body, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreatePaymentDto {
  @ApiProperty() @IsString() loanId!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsArray() installmentIds?: string[];
  @ApiProperty() @IsNumber() amount!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() type?: string;
  @ApiProperty() @IsString() idempotencyKey!: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsApiController {
  @Post()
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Créer paiement', description: 'Idempotence UNIQUE, audit, jamais SUCCEEDED sur navigateur' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  @ApiResponse({ status: 201 }) @ApiResponse({ status: 409 })
  async create(@Body() dto: CreatePaymentDto, @Headers('x-idempotency-key') _h?: string) {
    return { payment: { id: 'pay_9c1e', status: 'PROCESSING', provider: 'mollie', provider_payment_id: 'tr_xxxx' }, checkoutUrl: 'https://mollie.mock/checkout' };
  }

  @Get()
  @ApiBearerAuth('bearer') async list(@Req() req: any) {
    return { data: [{ id: 'pay_9c1e', loan_id: 'loan_1', amount: 463, status: 'SUCCEEDED' }], meta: { total: 1 } };
  }

  @Get(':id')
  @ApiBearerAuth('bearer') async get(@Param('id') id: string) {
    return { id, loan_id: 'loan_1', amount: 463, status: 'SUCCEEDED', provider_payment_id: 'tr_xxxx', transactions: [] };
  }
}
