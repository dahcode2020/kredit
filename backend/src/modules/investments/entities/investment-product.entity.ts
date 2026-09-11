export type InvestmentProductType = 'BOND' | 'FUND' | 'TERM_DEPOSIT' | 'SAVINGS' | 'EQUITY';
export type InvestmentProductStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
export class InvestmentProduct {
  id!: string;
  code!: string;
  name_i18n!: Record<string, string>;
  description_i18n?: Record<string, string>;
  type!: InvestmentProductType;
  country_code!: string;
  currency!: string;
  min_amount!: number;
  max_amount?: number | null;
  term_months?: number | null;
  yield_method!: 'FIXED' | 'VARIABLE' | 'FORMULA';
  yield_config!: Record<string, any>;
  risk_level!: number;
  risk_factors!: string[];
  capital_guaranteed!: boolean;
  guarantee_details?: Record<string, any> | null;
  status!: InvestmentProductStatus;
  total_subscribed!: number;
  max_total?: number | null;
  available_from!: Date;
  available_to?: Date | null;
  documents!: any[];
  needs_legal_validation!: boolean;
  validated_by_legal_at?: Date | null;
}
