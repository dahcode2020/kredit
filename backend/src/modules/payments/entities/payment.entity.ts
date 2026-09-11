export type PaymentType = 'INSTALLMENT' | 'EARLY_REPAYMENT' | 'FEES' | 'REFUND';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export class Payment {
  id!: string;
  loan_id!: string;
  customer_id!: string;
  type!: PaymentType;
  amount!: number;
  currency!: string;
  installment_ids!: string[];
  idempotency_key!: string;
  status!: PaymentStatus;
  provider!: string;
  provider_payment_id?: string | null;
  receipt_url?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: Date | null;
  created_at!: Date;
}
