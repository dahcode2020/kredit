export interface CreatePaymentInput {
  amount: number;
  currency: string;
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  idempotencyKey: string;
  customer: { email: string; locale: string };
  metadata: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<{ providerPaymentId: string; checkoutUrl?: string; status: string; raw?: any }>;
  getPaymentStatus(providerPaymentId: string): Promise<{ status: string; amount: number; raw: any }>;
  refund(providerPaymentId: string, amount?: number): Promise<{ providerRefundId: string; status: string; raw?: any }>;
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean;
}
