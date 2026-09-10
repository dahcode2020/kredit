import { Injectable } from '@nestjs/common';
@Injectable()
export class DecisionService {
  // Recommandation ≠ décision. L'ADMIN décide.
  recommend(scoring: any, rules: any) {
    if (scoring.debtRatio > (rules.maxDebtRatio ?? 0.33)) return 'RECOMMENDED_REJECT';
    if (scoring.grade === 'E') return 'RECOMMENDED_REJECT';
    if (scoring.grade === 'D') return 'RECOMMENDED_CONDITIONAL';
    return 'RECOMMENDED_APPROVE';
  }
  decide(applicationId: string, decision: string, actorRole: string, exceptionReason?: string) {
    if (decision.startsWith('EXCEPTIONAL') && !exceptionReason) throw new Error('Motif obligatoire pour décision exceptionnelle');
    if (!['ADMIN','SUPER_ADMIN'].includes(actorRole)) throw new Error('Seul ADMIN/SUPER_ADMIN peut décider');
    return { applicationId, decision, exceptionReason: exceptionReason ?? null, decidedBy: actorRole, audit: true };
  }
}
