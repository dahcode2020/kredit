import { Module } from '@nestjs/common';
import { KycVerificationService } from './kyc.service';
import { ComplianceLayer } from './compliance.layer';
import { KycController } from './kyc.controller';
import { AdminManualProvider } from './providers/admin-manual.provider';
import { MockAmlProvider } from './providers/mock-aml.provider';
import { BasicFraudProvider } from './providers/basic-fraud.provider';
import { EncryptionService } from '../../common/security/encryption.service';

@Module({
  controllers: [KycController],
  providers: [
    KycVerificationService,
    ComplianceLayer,
    EncryptionService,
    { provide: 'KycProvider', useClass: AdminManualProvider },
    { provide: 'AmlProvider', useClass: MockAmlProvider },
    { provide: 'FraudDetectionProvider', useClass: BasicFraudProvider },
  ],
  exports: [KycVerificationService, ComplianceLayer],
})
export class KycModule {}
