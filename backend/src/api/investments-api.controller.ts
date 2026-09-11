import { Controller, Get, Post, Param, Body, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SubscribeDto {
  @ApiProperty() @IsString() productId!: string;
  @ApiProperty() @IsNumber() amount!: number;
  @ApiProperty() @IsString() idempotencyKey!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() riskConfirm?: boolean;
  @ApiProperty() @IsBoolean() docsAck!: boolean;
}

@ApiTags('Investments')
@Controller()
export class InvestmentsApiController {
  @Get('investment-products')
  @ApiOperation({ summary: 'Catalogue produits investissement', description: 'Filtre pays/type/risque, cache 60s' })
  async listProducts(@Query('country') country?: string, @Query('type') type?: string, @Query('risk_lte') risk_lte?: string) {
    return { data: [{ id: 'prod_bond', code: 'BE_GREEN_BOND_2031', name_i18n: { fr: 'Obligation verte' }, type: 'BOND', country_code: 'BE', currency: 'EUR', min_amount: 5000, risk_level: 3, capital_guaranteed: false, yield_display: { text: '2.10% (indicatif)', disclaimer: 'Risque perte capital' }, status: 'ACTIVE' }], meta: { total: 1, page: 1, limit: 20 } };
  }

  @Get('investment-products/:id')
  @ApiOperation({ summary: 'Détail produit' })
  async getProduct(@Param('id') id: string) {
    return { id, code: 'BE_GREEN_BOND_2031', yield_display: { text: '2.10% (indicatif)' } };
  }

  @Post('investments')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Souscrire', description: 'Contrôles KYC, suitability, plafonds, idempotence, audit' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true })
  async subscribe(@Body() dto: SubscribeDto, @Req() req: any) {
    return { position: { id: 'pos_9c1e', product_id: dto.productId, amount_subscribed: dto.amount, status: 'ACTIVE' }, transaction: { id: 'tx_9c1e', type: 'SUBSCRIBED', status: 'SUCCEEDED' } };
  }

  @Get('investments')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Mon portefeuille' })
  async portfolio(@Req() req: any) {
    return { data: [{ id: 'pos_9c1e', product: { code: 'BE_GREEN_BOND_2031' }, amount_subscribed: 5000 }], meta: { total: 1 } };
  }

  @Get('investments/:id')
  @ApiBearerAuth('bearer') async getOne(@Param('id') id: string) {
    return { id, product: { code: 'BE_GREEN_BOND_2031' }, transactions: [] };
  }
}
