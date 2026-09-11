export type InvestorType = 'RETAIL' | 'PROFESSIONAL' | 'ELIGIBLE_COUNTERPARTY';
export class InvestorProfile {
  customer_id!: string;
  type!: InvestorType;
  risk_tolerance!: number;
  suitability_score?: number | null;
  suitability_answers?: Record<string, any> | null;
  accreditation_verified_at?: Date | null;
}
