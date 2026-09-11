import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class StartKycDto {
  @IsOptional() @IsObject() identityData?: any;
  @IsOptional() @IsObject() addressData?: any;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

export class VerifyKycDto {
  @IsEnum(['VERIFIED','REJECTED']) decision!: 'VERIFIED' | 'REJECTED';
  @IsOptional() @IsString() reason?: string;
}

export class OtpDto {
  @IsString() code!: string;
}
