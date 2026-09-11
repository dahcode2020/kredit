import { Injectable, Logger } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentProvider } from './providers/payment-provider.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class PaymentReconciliationService {
  private logger = new Logger(PaymentReconciliationService.name);
  constructor(
    private readonly payments: PaymentService,
    @Inject('PaymentProvider') private readonly provider: PaymentProvider,
  ) {}

  // Cron quotidien 03:00 — compare provider vs DB
  async reconcile(date: string) {
    // En prod: provider.listPayments({ from: date, to: date })
    // Ici on simule : cherche PROCESSING >15m et vérifie statut provider
    let fixed = 0;
    const candidates = (this.payments as any).payments as Map<string, any>;
    for (const p of candidates.values()) {
      if (p.status !== 'PROCESSING' || !p.provider_payment_id) continue;
      try {
        const prov = await this.provider.getPaymentStatus(p.provider_payment_id);
        if (prov.status === 'paid' || prov.status === 'succeeded') {
          await this.payments.markSucceeded(p.id, p.provider_payment_id, prov.raw);
          fixed++;
          this.logger.log(`reconciled ${p.id} -> SUCCEEDED via ${p.provider_payment_id}`);
        } else if (prov.status === 'failed') {
          await this.payments.markFailed(p.id, prov.status);
          fixed++;
        }
      } catch (e: any) {
        this.logger.warn(`reconcile ${p.id} error ${e.message}`);
      }
    }
    return { date, fixed, provider: this.provider.name };
  }

  // Rapport pour audit
  async report(from: string, to: string) {
    return this.reconcile(from);
  }
}
