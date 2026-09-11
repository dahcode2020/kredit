import { Injectable } from '@nestjs/common';
import { FraudDetectionProvider, FraudEvent, FraudResult } from './kyc-provider.interface';

@Injectable()
export class BasicFraudProvider implements FraudDetectionProvider {
  // Store velocity in memory (Redis en prod)
  private velocity = new Map<string, number[]>();

  async evaluate(event: FraudEvent): Promise<FraudResult> {
    const reasons: string[] = [];
    let risk: 'LOW'|'MEDIUM'|'HIGH' = 'LOW';
    let status: 'CLEAR'|'REVIEW'|'BLOCKED' = 'CLEAR';

    // Vélocité : >3 dossiers /24h
    const now = Date.now();
    const arr = this.velocity.get(event.customerId) ?? [];
    const recent = arr.filter(t => now - t < 86400000);
    recent.push(now);
    this.velocity.set(event.customerId, recent);
    if (recent.length > 3) {
      reasons.push('FRAUD_VELOCITY');
      risk = 'HIGH'; status = 'REVIEW';
    }
    // Email jetable
    if (event.email && /@(tempmail|10minutemail|yopmail)\./i.test(event.email)) {
      reasons.push('FRAUD_DISPOSABLE_EMAIL');
      risk = 'MEDIUM'; status = 'REVIEW';
    }
    // Doublon doc hash
    if (event.documentHashes && new Set(event.documentHashes).size !== event.documentHashes.length) {
      reasons.push('FRAUD_DUPLICATE_DOC');
      risk = 'HIGH'; status = 'REVIEW';
    }

    return { status, reasons, riskLevel: risk };
  }
}
