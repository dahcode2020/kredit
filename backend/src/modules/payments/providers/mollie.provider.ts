import { Injectable } from '@nestjs/common';
import { PaymentProvider, CreatePaymentInput } from './payment-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class MollieProvider implements PaymentProvider {
  readonly name = 'mollie';
  async createPayment(input: CreatePaymentInput) {
    const apiKey = process.env.MOLLIE_API_KEY;
    if (!apiKey) {
      // Mock en dev
      return { providerPaymentId: `tr_${input.idempotencyKey.slice(0,8)}`, checkoutUrl: `https://mollie.mock/checkout/${input.idempotencyKey}`, status: 'open' };
    }
    const res = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: { currency: input.currency, value: input.amount.toFixed(2) },
        description: input.description,
        redirectUrl: input.redirectUrl,
        webhookUrl: input.webhookUrl,
        metadata: input.metadata,
      }),
    });
    if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
    const json: any = await res.json();
    return { providerPaymentId: json.id, checkoutUrl: json._links?.checkout?.href, status: json.status, raw: json };
  }

  async getPaymentStatus(providerPaymentId: string) {
    const apiKey = process.env.MOLLIE_API_KEY!;
    const res = await fetch(`https://api.mollie.com/v2/payments/${providerPaymentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const json: any = await res.json();
    return { status: json.status, amount: Number(json.amount?.value), raw: json };
  }

  async refund(providerPaymentId: string, amount?: number) {
    const apiKey = process.env.MOLLIE_API_KEY!;
    const body: any = {};
    if (amount) body.amount = { currency: 'EUR', value: amount.toFixed(2) };
    const res = await fetch(`https://api.mollie.com/v2/payments/${providerPaymentId}/refunds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    return { providerRefundId: json.id, status: json.status, raw: json };
  }

  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
