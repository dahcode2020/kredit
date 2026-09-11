import { Injectable } from '@nestjs/common';
import { KycVerificationService } from './kyc.service';
import { AmlProvider, FraudDetectionProvider } from './providers/kyc-provider.interface';

export interface ComplianceResult {
  verified: boolean;
  blocked: boolean;
  riskLevel: 'LOW'|'MEDIUM'|'HIGH';
  reasons: string[];
  kycStatus: string;
  amlStatus: string;
  fraudStatus: string;
}

@Injectable()
export class ComplianceLayer {
  constructor(
    private readonly kycService: KycVerificationService,
    private readonly amlProvider: AmlProvider,
    private readonly fraudProvider: FraudDetectionProvider,
  ) {}

  async evaluate(customerId: string, context: { ip?: string; documentHashes?: string[]; email?: string; phone?: string }): Promise<ComplianceResult> {
    const kyc = await this.kycService.getByCustomer(customerId);
    const reasons: string[] = [];
    let blocked = false;
    let risk: 'LOW'|'MEDIUM'|'HIGH' = 'LOW';
    let amlStatus: 'CLEAR'|'REVIEW'|'HIT' = 'CLEAR';
    let fraudStatus: 'CLEAR'|'REVIEW'|'BLOCKED' = 'CLEAR';

    // KYC
    if (kyc.status !== 'VERIFIED') {
      blocked = true;
      reasons.push(`KYC_${kyc.status}`);
    }

    // AML (mock, à brancher ComplyAdvantage)
    try {
      const aml = await this.amlProvider.screen({ id: customerId, firstName: kyc.identity_data ? JSON.parse(kyc.identity_data).firstName ?? 'Test' : 'Test', lastName: 'User', country: 'BE' });
      amlStatus = aml.status;
      if (aml.status !== 'CLEAR') { blocked = true; reasons.push(...aml.reasons); risk = 'HIGH'; }
    } catch {}

    // Fraude
    try {
      const fraud = await this.fraudProvider.evaluate({ customerId, ip: context.ip, documentHashes: context.documentHashes, email: context.email, phone: context.phone });
      fraudStatus = fraud.status;
      if (fraud.status !== 'CLEAR') {
        reasons.push(...fraud.reasons);
        if (fraud.riskLevel === 'HIGH') risk = 'HIGH';
        else if (risk === 'LOW' && fraud.riskLevel === 'MEDIUM') risk = 'MEDIUM';
        if (fraud.status === 'BLOCKED') blocked = true;
        if (fraud.status === 'REVIEW') blocked = true; // bloque crédit tant que REVIEW non levé par admin
      }
    } catch {}

    return { verified: !blocked && kyc.status==='VERIFIED', blocked, riskLevel: risk, reasons, kycStatus: kyc.status, amlStatus, fraudStatus };
  }

  // Utilisé par Credit Decision Engine: si blocked → force REVIEW/REJECT
  async assertCanProceed(customerId: string, context: any): Promise<ComplianceResult> {
    const res = await this.evaluate(customerId, context);
    if (res.blocked) {
      // En prod on lève une erreur métier avec code
      // throw new ComplianceBlockedException(res)
    }
    return res;
  }
}
