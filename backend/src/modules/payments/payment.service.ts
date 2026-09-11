import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from './providers/payment-provider.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class PaymentService {
  private logger = new Logger(PaymentService.name);
  // Stores en mémoire pour build sans DB (remplacer par TypeORM en prod)
  private payments = new Map<string, any>(); // id -> Payment
  private byIdemp = new Map<string, any>();
  private byProvider = new Map<string, any>();
  private installments = new Map<string, any>();

  constructor(@Inject('PaymentProvider') private readonly provider: PaymentProvider) {}

  async create(dto: { loanId: string; customerId: string; amount: number; currency?: string; installmentIds?: string[]; type?: string; idempotencyKey: string }) {
    // Idempotence : si clé déjà connue, retourne même Payment (pas de double débit)
    const existing = this.byIdemp.get(dto.idempotencyKey);
    if (existing) {
      this.logger.log(`idempotent hit ${dto.idempotencyKey} -> ${existing.id}`);
      return existing;
    }
    const payment: any = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      loan_id: dto.loanId,
      customer_id: dto.customerId,
      type: dto.type ?? 'INSTALLMENT',
      amount: dto.amount,
      currency: dto.currency ?? 'EUR',
      installment_ids: dto.installmentIds ?? [],
      idempotency_key: dto.idempotencyKey,
      status: 'PENDING',
      provider: this.provider.name,
      provider_payment_id: null,
      receipt_url: null,
      created_at: new Date(),
    };
    this.payments.set(payment.id, payment);
    this.byIdemp.set(dto.idempotencyKey, payment);

    // Appel provider (avec retry 3× exponential)
    let providerRes: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        providerRes = await this.provider.createPayment({
          amount: dto.amount,
          currency: payment.currency,
          description: `KREDIT ${payment.type} ${payment.id}`,
          redirectUrl: `${process.env.FRONT_URL ?? 'https://kredit.be'}/payments/${payment.id}/processing`,
          webhookUrl: `${process.env.API_URL ?? 'https://api.kredit.be'}/api/v1/webhooks/payments/${this.provider.name}`,
          idempotencyKey: dto.idempotencyKey,
          customer: { email: 'customer@kredit.be', locale: 'fr' },
          metadata: { paymentId: payment.id, loanId: dto.loanId },
        });
        break;
      } catch (e: any) {
        if (e.status >= 500 && attempt < 2) { await new Promise(r=>setTimeout(r, 1000 * 2 ** attempt)); continue; }
        payment.status = 'FAILED';
        throw e;
      }
    }

    payment.provider_payment_id = providerRes.providerPaymentId;
    payment.status = 'PROCESSING';
    if (providerRes.providerPaymentId) this.byProvider.set(providerRes.providerPaymentId, payment);
    this.logger.log(`Payment ${payment.id} -> PROCESSING via ${this.provider.name} ${providerRes.providerPaymentId}`);
    // audit hash-chaîné en prod
    return { payment, checkoutUrl: providerRes.checkoutUrl };
  }

  async getById(id: string) {
    const p = this.payments.get(id);
    if (!p) throw new NotFoundException('Payment not found');
    return p;
  }

  async findByProviderId(providerPaymentId: string) {
    return this.byProvider.get(providerPaymentId);
  }

  async markSucceeded(paymentId: string, providerTransactionId: string, raw: any, confirmedBy?: string) {
    const p = this.payments.get(paymentId);
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status === 'SUCCEEDED') return p; // idempotent webhook
    p.status = 'SUCCEEDED';
    p.confirmed_by = confirmedBy ?? null;
    p.confirmed_at = new Date();
    p.receipt_url = `s3://kredit-receipts/${paymentId}.pdf`; // généré en prod
    this.logger.log(`Payment ${paymentId} SUCCEEDED via ${providerTransactionId}`);
    // Met à jour échéances
    for (const instId of p.installment_ids) {
      const inst = this.installments.get(instId);
      if (inst) { inst.status = 'PAID'; inst.paid_at = new Date(); }
    }
    return p;
  }

  async markFailed(paymentId: string, errorCode: string) {
    const p = this.payments.get(paymentId);
    if (!p) return;
    p.status = 'FAILED';
    (p as any).error_code = errorCode;
    return p;
  }

  // Confirmation admin/super admin suffit
  async adminConfirm(paymentId: string, actorId: string, reason: string) {
    if (!reason || reason.trim().length < 10) throw new ConflictException('Motif 10+ caractères requis');
    const p = this.payments.get(paymentId);
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status === 'SUCCEEDED') return p;
    // AdminConfirmProvider : pas de PSP, on fait foi serveur
    return this.markSucceeded(paymentId, `admin_${actorId}`, { reason, actorId }, actorId);
  }

  async refund(paymentId: string, amount?: number, reason?: string) {
    const p = this.payments.get(paymentId);
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status !== 'SUCCEEDED') throw new ConflictException('Only SUCCEEDED can be refunded');
    const refundRes = await this.provider.refund(p.provider_payment_id!, amount);
    p.status = amount && amount < p.amount ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
    this.logger.log(`Payment ${paymentId} REFUNDED ${amount ?? p.amount} via ${refundRes.providerRefundId}`);
    return p;
  }

  async earlyRepayment(loanId: string, customerId: string, amount: number, idempotencyKey: string) {
    // Vérifie solde restant, frais, recalcul échéancier en prod
    return this.create({ loanId, customerId, amount, type: 'EARLY_REPAYMENT', idempotencyKey });
  }
}
