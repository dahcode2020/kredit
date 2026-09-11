import { Injectable } from '@nestjs/common';
import { AmlProvider, AmlResult } from './kyc-provider.interface';

@Injectable()
export class MockAmlProvider implements AmlProvider {
  async screen(customer: { id: string; firstName: string; lastName: string; dob?: string; country: string }): Promise<AmlResult> {
    // MVP : CLEAR par défaut. Si pays à haut risque ou nom test, REVIEW.
    const highRisk = ['KP','IR','SY'];
    if (highRisk.includes(customer.country)) {
      return { status: 'REVIEW', reasons: ['high_risk_country'], checkedAt: new Date() };
    }
    return { status: 'CLEAR', reasons: [], checkedAt: new Date() };
  }
}
