import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { CustomerController } from './customer.controller';
import { CreditController } from './credit.controller';
import { InvestmentsApiController } from './investments-api.controller';
import { PaymentsApiController } from './payments-api.controller';
import { NotificationsApiController } from './notifications-api.controller';
import { AdminController } from './admin.controller';
import { SuperAdminController } from './super-admin.controller';

@Module({
  controllers: [
    AuthController,
    CustomerController,
    CreditController,
    InvestmentsApiController,
    PaymentsApiController,
    NotificationsApiController,
    AdminController,
    SuperAdminController,
  ],
})
export class ApiModule {}
