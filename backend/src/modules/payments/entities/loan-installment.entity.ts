export type InstallmentStatus = 'PENDING' | 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'WAIVED';
export class LoanInstallment {
  id!: string;
  loan_id!: string;
  number!: number;
  due_date!: string; // YYYY-MM-DD
  principal_due!: number;
  interest_due!: number;
  fees_due!: number;
  total_due!: number;
  principal_paid!: number;
  interest_paid!: number;
  fees_paid!: number;
  status!: InstallmentStatus;
  paid_at?: Date | null;
}
