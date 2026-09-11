export type KycStatus = 'NOT_STARTED' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export class KycVerification {
  id!: string;
  customer_id!: string;
  status!: KycStatus;
  identity_data?: string | null; // pgp_sym_encrypt
  address_data?: string | null;
  phone?: string | null;
  phone_verified_at?: Date | null;
  email?: string | null;
  email_verified_at?: Date | null;
  documents!: any[];
  verified_by?: string | null;
  verified_at?: Date | null;
  rejection_reason?: string | null;
  expires_at?: Date | null;
  created_at!: Date;
  updated_at!: Date;
}

export class ComplianceCheck {
  id!: string;
  kyc_verification_id!: string;
  aml_status!: 'CLEAR'|'REVIEW'|'HIT';
  sanctions_checked_at?: Date | null;
  sanctions_hit!: boolean;
  fraud_status!: 'CLEAR'|'REVIEW'|'BLOCKED';
  fraud_reasons!: string[];
  risk_level!: 'LOW'|'MEDIUM'|'HIGH';
  blocked!: boolean;
  checked_by?: string | null;
  created_at!: Date;
}
