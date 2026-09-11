import { Injectable } from '@nestjs/common';
import { PaymentProvider, CreatePaymentInput } from './payment-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  async createPayment(input: CreatePaymentInput) {
    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) return { providerPaymentId: `pi_${input.idempotencyKey.slice(0,8)}`, checkoutUrl: `https://stripe.mock/checkout/${input.idempotencyKey}`, status: 'requires_payment_method' };
    // En prod: stripe.paymentIntents.create({...}, {idempotencyKey: input.idempotencyKey})
    return { providerPaymentId: `pi_mock_${Date.now()}`, status: 'requires_payment_method' };
  }
  async getPaymentStatus(id: string) { return { status: 'succeeded', amount: 0, raw: {} }; }
  async refund(id: string, amount?: number) { return { providerRefundId: `re_${Date.now()}`, status: 'succeeded', raw: {} }; }
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    // Stripe: HMAC avec timestamp
    const parts = signature.split(',').reduce((acc: any, p) => { const [k,v]=p.split('='); acc[k]=v; return acc; }, {});
    const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
    return expected === parts.v1;
  }
}
