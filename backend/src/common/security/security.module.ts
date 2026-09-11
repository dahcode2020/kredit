import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from '../guards/roles.guard';
import { MfaGuard } from '../guards/mfa.guard';
import { EncryptionService } from './encryption.service';
import { RateLimiterService } from './rate-limiter.service';
import { AnomalyDetectorService } from './anomaly-detector.service';
import { AlertService } from './alert.service';
import { SecretRotationService } from './secret-rotation.service';
import { BackupService } from './backup.service';
import { SiemService } from './siem.service';
import { AuditModule } from '../../modules/audit/audit.module';

@Global()
@Module({
  imports: [AuditModule],
  providers: [
    EncryptionService,
    RateLimiterService,
    AnomalyDetectorService,
    AlertService,
    SecretRotationService,
    BackupService,
    SiemService,
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MfaGuard },
  ],
  exports: [EncryptionService, RateLimiterService, AnomalyDetectorService, AlertService, SecretRotationService, BackupService, SiemService],
})
export class SecurityModule {}
