import { IsEnum, IsString, IsOptional, IsUUID } from 'class-validator';
export class DispatchDto {
  @IsEnum(['ACCOUNT_CREATED','OTP_REQUESTED','APPLICATION_STARTED','APPLICATION_SUBMITTED','DOCUMENT_REQUIRED','APPLICATION_UNDER_REVIEW','APPLICATION_APPROVED','APPLICATION_APPROVED_EXCEPTION','APPLICATION_REJECTED','CONTRACT_READY','PAYMENT_RECEIVED','PAYMENT_DUE','PAYMENT_OVERDUE'])
  event!: string;
  @IsUUID() customerId!: string;
  @IsUUID() @IsOptional() entityId?: string;
  @IsOptional() payload?: Record<string, any>;
  @IsOptional() idempotencyKey?: string;
}

export class TemplateUpsertDto {
  @IsString() event!: string;
  @IsEnum(['EMAIL','SMS','WHATSAPP','PUSH']) channel!: 'EMAIL'|'SMS'|'WHATSAPP'|'PUSH';
  @IsEnum(['fr','en','nl','de']) locale!: 'fr'|'en'|'nl'|'de';
  @IsOptional() @IsString() subject?: string;
  @IsString() body!: string;
  @IsOptional() @IsString() whatsapp_template_name?: string;
}
