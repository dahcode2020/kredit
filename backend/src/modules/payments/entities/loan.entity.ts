export type LoanStatus = 'DRAFT' | 'ACTIVE' | 'REPAID' | 'DEFAULTED' | 'CLOSED';
export class Loan {
  id!: string;
  application_id!: string;
  customer_id!: string;
  provider!: string;
  principal!: number;
  taeg!: number;
  term_months!: number;
  monthly_amount!: number;
  fees!: Record<string, any>;
  status!: LoanStatus;
  disbursed_at?: Date | null;
  closed_at?: Date | null;
  created_at!: Date;
}
