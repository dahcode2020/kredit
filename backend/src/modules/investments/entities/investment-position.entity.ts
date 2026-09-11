export class InvestmentPosition {
  id!: string;
  customer_id!: string;
  product_id!: string;
  amount_subscribed!: number;
  amount_current!: number;
  status!: 'ACTIVE' | 'REDEEMED' | 'CANCELLED';
  subscribed_at!: Date;
}

export class InvestmentTransaction {
  id!: string;
  position_id!: string;
  type!: 'SUBSCRIBED' | 'DIVIDEND' | 'REDEMPTION' | 'FEES' | 'REFUND';
  amount!: number;
  status!: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  provider_payment_id?: string | null;
  idempotency_key?: string | null;
  created_at!: Date;
}
