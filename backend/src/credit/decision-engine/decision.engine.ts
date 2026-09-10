import { Injectable } from '@nestjs/common';
import { EligibilityResult, ScoringResult, Recommendation } from '../types/credit-engine.types';
@Injectable()
export class DecisionEngine {
  recommend(eligibility: EligibilityResult, score: ScoringResult): Recommendation {
    if (!eligibility.isEligible) return 'REJECT_RECOMMENDATION';
    if (eligibility.hardFailures.length>0) return 'REJECT_RECOMMENDATION';
    if (score.grade==='E') return 'REJECT_RECOMMENDATION';
    if (eligibility.debtRatio > 0.50) return 'REJECT_RECOMMENDATION';
    if (score.grade==='D' || score.grade==='C') return 'REVIEW_RECOMMENDATION';
    if (eligibility.softFailures.length>0) return 'REVIEW_RECOMMENDATION';
    if (eligibility.debtRatio > 0.33) return 'REVIEW_RECOMMENDATION';
    if ((score.grade==='A' || score.grade==='B') && eligibility.debtRatio <=0.33 && eligibility.repaymentCapacity > 500) return 'APPROVE_RECOMMENDATION';
    return 'REVIEW_RECOMMENDATION';
  }
}
