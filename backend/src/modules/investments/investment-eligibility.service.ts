import { Injectable } from '@nestjs/common';

@Injectable()
export class InvestmentEligibilityService {
  // En prod injecte repos
  private restrictions = [
    { country_code:'BE', investor_type:'RETAIL', product_type:'BOND', allowed:true, max_amount:100000, requires_accreditation:false },
    { country_code:'BE', investor_type:'RETAIL', product_type:'FUND', allowed:true, max_amount:50000, requires_accreditation:false },
    { country_code:'BE', investor_type:'RETAIL', product_type:'EQUITY', allowed:false, requires_accreditation:true },
    { country_code:'BE', investor_type:'PROFESSIONAL', product_type:'EQUITY', allowed:true, requires_accreditation:false },
  ];
  async canSubscribe(params: { customerId: string; product: any; amount: number; investorProfile: any }): Promise<{ allowed: boolean; reasons: string[] }> {
    const { product, amount, investorProfile } = params;
    const reasons: string[] = [];
    let allowed = true;

    // 1. Produit actif + fenêtre
    if (product.status !== 'ACTIVE') { allowed = false; reasons.push('PRODUCT_NOT_ACTIVE'); }
    if (product.needs_legal_validation && !product.validated_by_legal_at) { allowed = false; reasons.push('NEEDS_LEGAL_VALIDATION'); }

    // 2. Montants globaux
    if (amount < product.min_amount) { allowed = false; reasons.push('BELOW_MIN'); }
    if (product.max_amount && amount > product.max_amount) { allowed = false; reasons.push('ABOVE_MAX'); }
    if (product.max_total && (product.total_subscribed + amount) > product.max_total) { allowed = false; reasons.push('EXCEEDS_EMISSION_CAP'); }

    // 3. Restrictions pays/type
    const r = this.restrictions.find(x => x.country_code===product.country_code && x.investor_type===investorProfile.type && x.product_type===product.type);
    if (r) {
      if (!r.allowed) { allowed = false; reasons.push('RESTRICTED_FOR_INVESTOR_TYPE'); }
      if (r.max_amount && amount > r.max_amount) { allowed = false; reasons.push('RESTRICTED_MAX_FOR_TYPE'); }
      if (r.requires_accreditation && !investorProfile.accreditation_verified_at) { allowed = false; reasons.push('REQUIRES_ACCREDITATION'); }
    }

    // 4. Risque
    if (product.risk_level > investorProfile.risk_tolerance && !(params as any).riskConfirm) {
      allowed = false; reasons.push('RISK_EXCEEDS_TOLERANCE');
    }

    return { allowed, reasons };
  }

  displayYield(product: any, locale: string): { text: string; disclaimer?: string; guaranteed: boolean } {
    const guaranteed = !!product.capital_guaranteed && !!product.guarantee_details?.validated_by_legal_at;
    if (!guaranteed) {
      const rate = product.yield_config?.fixed_rate ? `${(product.yield_config.fixed_rate*100).toFixed(2)}%` : 'variable';
      return { text: `${rate} (indicatif)`, disclaimer: 'Risque de perte en capital. Rendement indicatif non garanti.', guaranteed: false };
    }
    return { text: `${(product.yield_config.fixed_rate*100).toFixed(2)}% garanti par ${product.guarantee_details.guarantor}`, guaranteed: true };
  }
}
