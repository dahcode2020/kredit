import { Controller, Get, Post, Patch, Param, Body, Query, Req } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { CreateProductDto, SubscribeDto, QuizDto } from './dto/investment.dto';

@Controller('investments')
export class InvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @Get('products')
  async list(@Query('country') country?: string, @Query('type') type?: string, @Query('risk_lte') risk_lte?: string) {
    return this.investments.listProducts({ country, type, risk_lte: risk_lte ? Number(risk_lte) : undefined, status: 'ACTIVE' });
  }

  @Get('products/:id')
  async get(@Param('id') id: string) {
    return this.investments.getProduct(id);
  }

  @Get('portfolio')
  async portfolio(@Req() req: any) {
    const customerId = req.user?.sub ?? 'cust_demo';
    return this.investments.portfolio(customerId);
  }

  @Post(':productId/subscribe')
  async subscribe(@Param('productId') productId: string, @Body() dto: SubscribeDto, @Req() req: any) {
    const customerId = req.user?.sub ?? 'cust_demo';
    return this.investments.subscribe(productId, customerId, dto);
  }

  @Post('quiz')
  async quiz(@Body() dto: QuizDto, @Req() req: any) {
    const customerId = req.user?.sub ?? 'cust_demo';
    return this.investments.quiz(customerId, dto.answers);
  }
}

@Controller('admin/investments')
export class AdminInvestmentsController {
  constructor(private readonly investments: InvestmentsService) {}

  @Post('products')
  // @Roles('SUPER_ADMIN')
  async create(@Body() dto: CreateProductDto, @Req() req: any) {
    return this.investments.createProduct(dto, req.user?.sub ?? 'super@kredit.be');
  }

  @Patch('products/:id/status')
  async setStatus(@Param('id') id: string, @Body() body: { status: 'ACTIVE'|'SUSPENDED'|'CLOSED'; reason?: string }, @Req() req: any) {
    return this.investments.updateStatus(id, body.status, req.user?.sub ?? 'super@kredit.be', body.reason);
  }

  @Get('positions')
  async positions(@Query('productId') productId?: string) {
    return this.investments.adminPositions(productId);
  }
}
