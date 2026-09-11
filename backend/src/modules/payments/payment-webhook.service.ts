import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentProvider } from './providers/payment-provider.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class PaymentWebhookService {
  private logger = new Logger(PaymentWebhookService.name);
  // Dedup webhook via provider_transaction_id
  private seen = new Set<string>();

  constructor(
    private readonly payments: PaymentService,
    @Inject('PaymentProvider') private readonly provider: PaymentProvider,
  ) {}

  async handleMollie(rawBody: string, signature: string, payload: any) {
    const secret = process.env.MOLLIE_WEBHOOK_SECRET ?? 'dev';
    if (!this.provider.verifyWebhookSignature(rawBody, signature, secret)) throw new UnauthorizedException('Invalid signature');
    const providerPaymentId = payload.id ?? payload.paymentId;
    if (this.seen.has(providerPaymentId + payload.status)) return { already: true };
    this.seen.add(providerPaymentId + payload.status);

    const payment = await this.payments.findByProviderId(providerPaymentId);
    if (!payment) { this.logger.warn(`webhook unknown ${providerPaymentId}`); return { ignored: true }; }

    if (payload.status === 'paid' || payload.status === 'succeeded') {
      await this.payments.markSucceeded(payment.id, providerPaymentId, payload);
    } else if (payload.status === 'failed' || payload.status === 'canceled') {
      await this.payments.markFailed(payment.id, payload.status);
    }
    return { ok: true };
  }

  async handleStripe(rawBody: string, signature: string, payload: any) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? 'dev';
    if (!this.provider.verifyWebhookSignature(rawBody, signature, secret)) throw new UnauthorizedException('Invalid signature');
    const providerPaymentId = payload.data?.object?.id ?? payload.id;
    const status = payload.type === 'payment_intent.succeeded' ? 'succeeded' : payload.type;
    return this.handleMollie(rawBody, signature, { id: providerPaymentId, status });
  }
}
