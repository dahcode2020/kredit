import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { KycModule } from './modules/kyc/kyc.module';
import { CountriesModule } from './modules/countries/countries.module';
import { CreditModule } from './credit/credit.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { DecisionModule } from './modules/decision/decision.module';
import { RepaymentModule } from './modules/repayment/repayment.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminModule } from './modules/admin/admin.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { ApiModule } from './api/api.module';
@Module({
  imports: [ ConfigModule.forRoot({ isGlobal: true }), AuthModule, CustomersModule, KycModule, CountriesModule, CreditModule, ApplicationsModule, ScoringModule, DecisionModule, RepaymentModule, PaymentsModule, DocumentsModule, NotificationsModule, AuditModule, AdminModule, InvestmentsModule, ApiModule ],
})
export class AppModule {}
