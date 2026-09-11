import { Injectable } from '@nestjs/common';
import { PaymentProvider, CreatePaymentInput } from './payment-provider.interface';

// Provider interne : pas d'appel PSP, la confirmation admin suffit
@Injectable()
export class AdminConfirmProvider implements PaymentProvider {
  readonly name = 'admin-confirm';
  async createPayment(input: CreatePaymentInput) {
    return { providerPaymentId: `admin_${input.idempotencyKey.slice(0,8)}`, status: 'pending' };
  }
  async getPaymentStatus(id: string) { return { status: 'pending', amount: 0, raw: {} }; }
  async refund(id: string) { return { providerRefundId: `re_admin_${Date.now()}`, status: 'succeeded', raw: {} }; }
  verifyWebhookSignature(): boolean { return true; }
}
