export type TransactionType = 'AUTHORIZATION' | 'CAPTURE' | 'REFUND' | 'CHARGEBACK';
export type TransactionStatus = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
export class PaymentTransaction {
  id!: string;
  payment_id!: string;
  provider!: string;
  provider_transaction_id?: string | null;
  type!: TransactionType;
  amount!: number;
  status!: TransactionStatus;
  raw_payload?: any;
  signature_valid!: boolean;
  error_code?: string | null;
  created_at!: Date;
}
