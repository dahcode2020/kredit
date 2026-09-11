import { Injectable } from '@nestjs/common';
import { KycProvider, KycResult, KycStartInput, KycStatus } from './kyc-provider.interface';

// MVP : aucune API externe, l'admin valide manuellement
@Injectable()
export class AdminManualProvider implements KycProvider {
  readonly name = 'admin-manual';
  // En prod on injecte un repo TypeORM pour kyc_verifications
  private store = new Map<string, KycResult>();

  async startVerification(input: KycStartInput) {
    const verificationId = `kyc-${input.customerId}`;
    const result: KycResult = { verificationId, status: 'IN_REVIEW' };
    this.store.set(verificationId, result);
    // Notifie admin (EventEmitter) → /admin/kyc-queue
    return { verificationId, status: 'IN_REVIEW' as KycStatus };
  }

  async getResult(verificationId: string): Promise<KycResult> {
    return this.store.get(verificationId) ?? { verificationId, status: 'NOT_STARTED' };
  }

  // Appelé par KycService quand admin approuve/rejette
  async setResult(verificationId: string, status: KycStatus, reason?: string) {
    this.store.set(verificationId, { verificationId, status, reason });
  }
}
