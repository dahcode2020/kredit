import { Controller, Post, Get, Param, Body, Req, Headers, UseGuards, RawBodyRequest } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { CreatePaymentDto, ConfirmPaymentDto, RefundDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  async create(@Body() dto: CreatePaymentDto, @Req() req: any, @Headers('x-idempotency-key') idemHeader?: string) {
    const customerId = req.user?.sub ?? 'cust_demo';
    const key = idemHeader ?? dto.idempotencyKey;
    return this.payments.create({ loanId: dto.loanId, customerId, amount: dto.amount, currency: dto.currency, installmentIds: dto.installmentIds, type: dto.type as any, idempotencyKey: key });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.payments.getById(id);
  }

  @Post(':id/confirm')
  // @Roles('ADMIN','SUPER_ADMIN') @RequireMFA()
  async adminConfirm(@Param('id') id: string, @Body() dto: ConfirmPaymentDto, @Req() req: any) {
    const actorId = req.user?.sub ?? 'admin@kredit.be';
    return this.payments.adminConfirm(id, actorId, dto.reason);
  }

  @Post(':id/refund')
  // @Roles('SUPER_ADMIN')
  async refund(@Param('id') id: string, @Body() dto: RefundDto) {
    return this.payments.refund(id, dto.amount, dto.reason);
  }

  @Post(':id/early-repayment')
  async early(@Param('id') id: string, @Body() body: { loanId: string; amount: number; idempotencyKey: string }, @Req() req: any) {
    const customerId = req.user?.sub ?? 'cust_demo';
    return this.payments.earlyRepayment(body.loanId, customerId, body.amount, body.idempotencyKey);
  }
}

@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private readonly webhooks: PaymentWebhookService) {}

  @Post('mollie')
  async mollie(@Req() req: RawBodyRequest<Request>, @Headers('x-mollie-signature') sig?: string) {
    const raw = (req as any).rawBody ?? JSON.stringify(req.body);
    return this.webhooks.handleMollie(raw, sig ?? '', req.body);
  }

  @Post('stripe')
  async stripe(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') sig?: string) {
    const raw = (req as any).rawBody ?? JSON.stringify(req.body);
    return this.webhooks.handleStripe(raw, sig ?? '', req.body);
  }
}

@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly recon: PaymentReconciliationService) {}

  @Post('reconcile')
  // @Roles('SUPER_ADMIN')
  async reconcile(@Body() body: { date: string }) {
    return this.recon.reconcile(body.date);
  }
}
