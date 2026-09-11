import { Controller, Get, Put, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateProfileDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() firstName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() lastName?: string;
  @ApiProperty({ enum: ['fr','en','nl','de'], required: false }) @IsOptional() @IsEnum(['fr','en','nl','de']) locale?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() address?: any;
}

@ApiTags('Customer')
@ApiBearerAuth('bearer')
@Controller('customer')
export class CustomerController {
  @Get('profile')
  @ApiOperation({ summary: 'Mon profil', description: 'CUSTOMER self' })
  @ApiResponse({ status: 200 }) @ApiResponse({ status: 401 })
  async getProfile(@Req() req: any) {
    return { id: 'usr_9c1e', email: 'alex@kredit.be', phone: '+32470123456', phoneVerifiedAt: new Date().toISOString(), locale: 'fr', country: 'BE', kycStatus: 'VERIFIED', createdAt: new Date().toISOString() };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Modifier profil', description: 'Whitelist, audit customer.update, idempotence' })
  async updateProfile(@Body() dto: UpdateProfileDto) {
    return { id: 'usr_9c1e', ...dto, updatedAt: new Date().toISOString() };
  }

  @Get('security')
  @ApiOperation({ summary: 'Sécurité' })
  async getSecurity() {
    return { mfaEnabled: false, mfaVerifiedAt: null, lastLoginAt: new Date().toISOString(), sessions: [{ ip: '185.12.34.56', device: 'Chrome', at: new Date().toISOString() }], phoneVerified: true, emailVerified: true };
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Préférences notifications' })
  async getNotifications() {
    return { locale: 'fr', emailEnabled: true, smsEnabled: true, whatsappEnabled: true, pushEnabled: true, preferences: { PAYMENT_DUE: { sms: true } }, consentWhatsappAt: new Date().toISOString() };
  }
}
