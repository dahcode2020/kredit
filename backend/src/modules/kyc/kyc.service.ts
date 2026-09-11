import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { KycProvider, AmlProvider, FraudDetectionProvider } from './providers/kyc-provider.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class KycVerificationService {
  private logger = new Logger(KycVerificationService.name);
  // En prod: inject TypeORM repos
  private store = new Map<string, any>(); // customerId -> KycVerification

  constructor(
    @Inject('KycProvider') private readonly kycProvider: KycProvider,
    @Inject('AmlProvider') private readonly amlProvider: AmlProvider,
    @Inject('FraudDetectionProvider') private readonly fraudProvider: FraudDetectionProvider,
  ) {}

  async start(customerId: string, dto: any) {
    const existing = this.store.get(customerId);
    if (existing?.status === 'VERIFIED') return existing;
    const { verificationId, status } = await this.kycProvider.startVerification({ customerId, ...dto });
    const record = {
      id: verificationId,
      customer_id: customerId,
      status,
      identity_data: dto.identityData ? JSON.stringify(dto.identityData) : null,
      address_data: dto.addressData ? JSON.stringify(dto.addressData) : null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      documents: [],
      created_at: new Date(), updated_at: new Date(),
    };
    this.store.set(customerId, record);
    this.logger.log(`KYC IN_REVIEW for ${customerId} via ${this.kycProvider.name}`);
    return record;
  }

  async getByCustomer(customerId: string) {
    return this.store.get(customerId) ?? { customer_id: customerId, status: 'NOT_STARTED' };
  }

  async verify(customerId: string, actorId: string, actorRole: string, decision: 'VERIFIED'|'REJECTED', reason?: string) {
    if (!['ADMIN','SUPER_ADMIN'].includes(actorRole)) throw new ForbiddenException('ADMIN only');
    if (decision === 'REJECTED' && (!reason || reason.trim().length < 10)) throw new ForbiddenException('Motif 10+ caractères requis');
    const rec = this.store.get(customerId);
    if (!rec) throw new NotFoundException('KYC not found');
    const prev = rec.status;
    rec.status = decision;
    rec.verified_by = actorId;
    rec.verified_at = new Date();
    rec.rejection_reason = decision === 'REJECTED' ? reason : null;
    rec.expires_at = decision === 'VERIFIED' ? new Date(Date.now() + 365*24*3600000) : null;
    rec.updated_at = new Date();
    this.store.set(customerId, rec);
    // Notifie provider si besoin
    if ((this.kycProvider as any).setResult) await (this.kycProvider as any).setResult(rec.id, decision, reason);
    this.logger.log(`KYC ${prev} -> ${decision} for ${customerId} by ${actorId}`);
    // audit hash-chaîné (via AuditService en prod)
    return rec;
  }

  async isVerified(customerId: string): Promise<boolean> {
    const rec = this.store.get(customerId);
    if (!rec) return false;
    if (rec.status !== 'VERIFIED') return false;
    if (rec.expires_at && new Date(rec.expires_at) < new Date()) {
      rec.status = 'EXPIRED';
      return false;
    }
    return true;
  }

  async verifyPhone(customerId: string, phone: string) {
    const rec = this.store.get(customerId) ?? { customer_id: customerId, status: 'NOT_STARTED' };
    rec.phone = phone; rec.phone_verified_at = new Date();
    this.store.set(customerId, rec);
    return rec;
  }

  async verifyEmail(customerId: string, email: string) {
    const rec = this.store.get(customerId) ?? { customer_id: customerId, status: 'NOT_STARTED' };
    rec.email = email; rec.email_verified_at = new Date();
    this.store.set(customerId, rec);
    return rec;
  }
}
