import { Module } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { InvestmentEligibilityService } from './investment-eligibility.service';
import { InvestmentsController, AdminInvestmentsController } from './investments.controller';

@Module({
  controllers: [InvestmentsController, AdminInvestmentsController],
  providers: [InvestmentsService, InvestmentEligibilityService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
