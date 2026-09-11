import { Controller, Post, Body, Req, Res, HttpCode, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RegisterDto {
  @ApiProperty({ example: 'alex@kredit.be' }) @IsEmail() email!: string;
  @ApiProperty({ example: 'Customer123!' }) @IsString() @MinLength(8) password!: string;
  @ApiProperty({ enum: ['fr','en','nl','de'], required: false }) @IsOptional() @IsEnum(['fr','en','nl','de']) locale?: string;
  @ApiProperty() @IsBoolean() acceptGdpr!: boolean;
}
class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() password!: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() totp?: string;
}
class VerifyEmailDto { @ApiProperty() @IsString() code!: string; }
class VerifyPhoneDto { @ApiProperty() @IsString() phone!: string; @ApiProperty() @IsString() code!: string; }
class TwoFaDto { @ApiProperty({ enum: ['enable','verify','disable'] }) @IsEnum(['enable','verify','disable']) action!: string; @ApiProperty({ required: false }) @IsOptional() @IsString() code?: string; }

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Post('register')
  @ApiOperation({ summary: 'Créer compte CUSTOMER', description: 'Idempotence via X-Idempotency-Key, audit auth.register' })
  @ApiHeader({ name: 'X-Idempotency-Key', required: true }) @ApiHeader({ name: 'X-Request-Id', required: false })
  @ApiResponse({ status: 201, description: 'Created' }) @ApiResponse({ status: 409, description: 'EMAIL_ALREADY_EXISTS' })
  @HttpCode(201)
  async register(@Body() dto: RegisterDto, @Headers('x-idempotency-key') _k?: string) {
    if (!dto.acceptGdpr) return { statusCode: 400, code: 'GDPR_REQUIRED' };
    return { id: 'usr_9c1e', email: dto.email, locale: dto.locale ?? 'fr' };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login', description: 'Rate 5/min, lockout 15m après 5 échecs, audit' })
  @ApiResponse({ status: 200 }) @ApiResponse({ status: 401 }) @ApiResponse({ status: 423 })
  async login(@Body() dto: LoginDto) {
    return { accessToken: 'eyJ...', user: { id: 'usr_9c1e', role: 'CUSTOMER', locale: 'fr' } };
  }

  @Post('logout')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Logout' })
  @ApiResponse({ status: 204 })
  @HttpCode(204)
  async logout() { return; }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT', description: 'Cookie refreshToken httpOnly, rotation' })
  async refresh(@Req() req: any) {
    return { accessToken: 'eyJ...' };
  }

  @Post('verify-email')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Vérifier email par OTP' })
  async verifyEmail(@Body() dto: VerifyEmailDto) { return { verified: true, emailVerifiedAt: new Date().toISOString() }; }

  @Post('verify-phone')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Vérifier téléphone par OTP' })
  async verifyPhone(@Body() dto: VerifyPhoneDto) { return { verified: true, phoneVerifiedAt: new Date().toISOString() }; }

  @Post('2fa')
  @ApiBearerAuth('bearer') @ApiOperation({ summary: 'Gérer 2FA TOTP' })
  async twoFa(@Body() dto: TwoFaDto) {
    if (dto.action === 'enable') return { secret: 'otpauth://totp/KREDIT:alex@kredit.be?secret=JBSWY3DPEHPK3PXP', qr: 'data:image/png;base64,...' };
    return { enabled: true, mfa_verified_at: new Date().toISOString() };
  }
}
