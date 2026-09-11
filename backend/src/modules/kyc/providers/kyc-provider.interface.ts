export type KycStatus = 'NOT_STARTED' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface KycStartInput {
  customerId: string;
  identityData?: any;
  addressData?: any;
}

export interface KycResult {
  verificationId: string;
  status: KycStatus;
  reason?: string;
}

export interface KycProvider {
  readonly name: string;
  startVerification(input: KycStartInput): Promise<{ verificationId: string; status: KycStatus }>;
  getResult(verificationId: string): Promise<KycResult>;
  handleWebhook?(payload: any): Promise<void>;
}

export interface AmlResult { status: 'CLEAR' | 'REVIEW' | 'HIT'; reasons: string[]; checkedAt: Date; }

export interface AmlProvider {
  screen(customer: { id: string; firstName: string; lastName: string; dob?: string; country: string }): Promise<AmlResult>;
}

export interface FraudEvent { customerId: string; ip?: string; deviceFp?: string; documentHashes?: string[]; email?: string; phone?: string; }
export interface FraudResult { status: 'CLEAR' | 'REVIEW' | 'BLOCKED'; reasons: string[]; riskLevel: 'LOW'|'MEDIUM'|'HIGH'; }

export interface FraudDetectionProvider {
  evaluate(event: FraudEvent): Promise<FraudResult>;
}
