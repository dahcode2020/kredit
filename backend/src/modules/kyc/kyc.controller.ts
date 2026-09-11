import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { KycVerificationService } from './kyc.service';
import { ComplianceLayer } from './compliance.layer';
import { StartKycDto, VerifyKycDto } from './dto/kyc.dto';

// @UseGuards(AuthGuard, RolesGuard, ThrottlerGuard, MfaGuard)
// @Roles('CUSTOMER') pour start, @Roles('ADMIN','SUPER_ADMIN') pour verify
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycVerificationService, private readonly compliance: ComplianceLayer) {}

  @Post('start')
  async start(@Req() req: any, @Body() dto: StartKycDto) {
    const customerId = req.user?.sub ?? (dto as any).customerId ?? 'me';
    return this.kyc.start(customerId, dto);
  }

  @Get(':customerId')
  async get(@Param('customerId') customerId: string) {
    return this.kyc.getByCustomer(customerId);
  }

  @Get(':customerId/compliance')
  async complianceCheck(@Param('customerId') customerId: string) {
    return this.compliance.evaluate(customerId, {});
  }

  // ADMIN / SUPER_ADMIN uniquement — MFA requis
  // @Roles('ADMIN','SUPER_ADMIN') @RequireMFA()
  @Post(':customerId/verify')
  async verify(@Param('customerId') customerId: string, @Body() dto: VerifyKycDto, @Req() req: any) {
    const actorId = req.user?.sub ?? 'admin@kredit.be';
    const role = req.user?.role ?? 'ADMIN';
    return this.kyc.verify(customerId, actorId, role, dto.decision, dto.reason);
  }

  @Post(':customerId/phone/verify')
  async verifyPhone(@Param('customerId') customerId: string, @Body() body: { phone: string; code: string }) {
    // OTP vérifié via NotificationsService + rate limit 3/min
    return this.kyc.verifyPhone(customerId, body.phone);
  }

  @Post(':customerId/email/verify')
  async verifyEmail(@Param('customerId') customerId: string, @Body() body: { email: string; code: string }) {
    return this.kyc.verifyEmail(customerId, body.email);
  }
}
