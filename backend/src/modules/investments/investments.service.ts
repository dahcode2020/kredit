import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InvestmentEligibilityService } from './investment-eligibility.service';

@Injectable()
export class InvestmentsService {
  // Stores mémoire pour build (prod = TypeORM)
  private products = new Map<string, any>([
    ['prod_bond', { id:'prod_bond', code:'BE_GREEN_BOND_2031', name_i18n:{fr:'Obligation verte BE 2031'}, type:'BOND', country_code:'BE', currency:'EUR', min_amount:5000, max_amount:100000, term_months:60, yield_method:'FIXED', yield_config:{fixed_rate:0.021}, risk_level:3, capital_guaranteed:false, status:'ACTIVE', total_subscribed:1200000, max_total:5000000, needs_legal_validation:false, validated_by_legal_at: new Date() }],
    ['prod_deposit', { id:'prod_deposit', code:'BE_TERM_DEPOSIT_12M', name_i18n:{fr:'Dépôt à terme 12M'}, type:'TERM_DEPOSIT', country_code:'BE', currency:'EUR', min_amount:1000, max_amount:100000, term_months:12, yield_method:'FIXED', yield_config:{fixed_rate:0.015}, risk_level:1, capital_guaranteed:true, guarantee_details:{guarantor:'Fonds de garantie BE', validated_by_legal_at: new Date()}, status:'ACTIVE', total_subscribed:800000, max_total:10000000, needs_legal_validation:false, validated_by_legal_at: new Date() }],
  ]);
  private positions = new Map<string, any>();
  private profiles = new Map<string, any>();

  constructor(private readonly eligibility: InvestmentEligibilityService) {}

  async listProducts(filters: { country?: string; type?: string; risk_lte?: number; status?: string }) {
    let arr = Array.from(this.products.values());
    if (filters.country) arr = arr.filter(p=>p.country_code===filters.country);
    if (filters.type) arr = arr.filter(p=>p.type===filters.type);
    if (filters.risk_lte != null) arr = arr.filter(p=>p.risk_level <= filters.risk_lte!);
    if (filters.status) arr = arr.filter(p=>p.status===filters.status);
    // Ajoute displayYield sans garantie
    return arr.map(p=>({ ...p, yield_display: this.eligibility.displayYield(p, 'fr') }));
  }

  async getProduct(id: string) {
    const p = this.products.get(id) ?? Array.from(this.products.values()).find(x=>x.code===id);
    if (!p) throw new NotFoundException('Product not found');
    return { ...p, yield_display: this.eligibility.displayYield(p, 'fr') };
  }

  // Admin
  async createProduct(dto: any, actorId: string) {
    const id = `prod_${Date.now()}`;
    const p = { id, ...dto, total_subscribed:0, status:'DRAFT', needs_legal_validation:true, validated_by_legal_at:null, created_at: new Date() };
    this.products.set(id, p);
    return p;
  }

  async updateStatus(id: string, status: 'ACTIVE'|'SUSPENDED'|'CLOSED', actorId: string, reason?: string) {
    const p = this.products.get(id);
    if (!p) throw new NotFoundException('Product not found');
    if (status==='ACTIVE' && p.needs_legal_validation && !p.validated_by_legal_at) throw new ForbiddenException('Validation juridique requise');
    const prev = p.status;
    p.status = status;
    p.updated_at = new Date();
    // audit
    return { ...p, prevStatus: prev, reason };
  }

  // Client
  async subscribe(productId: string, customerId: string, dto: { amount: number; idempotencyKey: string; riskConfirm?: boolean; docsAck?: boolean }) {
    const product = await this.getProduct(productId);
    const profile = this.profiles.get(customerId) ?? { customer_id: customerId, type:'RETAIL', risk_tolerance:3, suitability_score: 60 };
    // Contrôles bloquants
    if (!dto.docsAck) throw new ForbiddenException('Documents PRIIPs/DIC must be acknowledged');
    // KYC check (en prod via KycService)
    const kycVerified = true; // stub
    if (!kycVerified) throw new ForbiddenException('KYC VERIFIED required');
    const elig = await this.eligibility.canSubscribe({ customerId, product, amount: dto.amount, investorProfile: profile });
    if (!elig.allowed) throw new ForbiddenException(`Not eligible: ${elig.reasons.join(', ')}`);

    // Idempotence
    const existing = Array.from(this.positions.values()).find(x=> (x as any).idempotencyKey===dto.idempotencyKey);
    if (existing) return existing;

    // Crée position + transaction PENDING (paiement via PaymentService en prod)
    const pos = {
      id: `pos_${Date.now()}`,
      customer_id: customerId,
      product_id: productId,
      amount_subscribed: dto.amount,
      amount_current: dto.amount,
      status: 'ACTIVE',
      subscribed_at: new Date(),
      idempotencyKey: dto.idempotencyKey,
    };
    this.positions.set(pos.id, pos);
    product.total_subscribed += dto.amount;

    const tx = { id:`inv_tx_${Date.now()}`, position_id: pos.id, type:'SUBSCRIBED', amount: dto.amount, status:'SUCCEEDED', idempotency_key: dto.idempotencyKey, created_at: new Date() };
    return { position: pos, transaction: tx, yield_display: this.eligibility.displayYield(product, 'fr') };
  }

  async portfolio(customerId: string) {
    return Array.from(this.positions.values()).filter(p=>p.customer_id===customerId);
  }

  async quiz(customerId: string, answers: Record<string,any>) {
    // MiFID-like simple : 5 questions -> score 0-100 -> risk_tolerance
    const score = Math.min(100, Object.keys(answers).length * 20 + 20);
    const risk = score > 80 ? 5 : score > 50 ? 3 : 2;
    const profile = { customer_id: customerId, type:'RETAIL', risk_tolerance: risk, suitability_score: score, suitability_answers: answers };
    this.profiles.set(customerId, profile);
    return profile;
  }

  async adminPositions(productId?: string) {
    let arr = Array.from(this.positions.values());
    if (productId) arr = arr.filter(p=>p.product_id===productId);
    return arr;
  }
}
