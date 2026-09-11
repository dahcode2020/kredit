import { IsString, IsNumber, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';

export class CreateProductDto {
  @IsString() code!: string;
  @IsObject() name_i18n!: Record<string,string>;
  @IsOptional() @IsObject() description_i18n?: Record<string,string>;
  @IsEnum(['BOND','FUND','TERM_DEPOSIT','SAVINGS','EQUITY']) type!: string;
  @IsString() country_code!: string;
  @IsOptional() @IsString() currency?: string;
  @IsNumber() min_amount!: number;
  @IsOptional() @IsNumber() max_amount?: number;
  @IsOptional() @IsNumber() term_months?: number;
  @IsEnum(['FIXED','VARIABLE','FORMULA']) yield_method!: string;
  @IsObject() yield_config!: Record<string,any>;
  @IsNumber() risk_level!: number;
  @IsOptional() @IsBoolean() capital_guaranteed?: boolean;
}

export class SubscribeDto {
  @IsNumber() amount!: number;
  @IsString() idempotencyKey!: string;
  @IsOptional() @IsBoolean() riskConfirm?: boolean;
  @IsOptional() @IsBoolean() docsAck?: boolean;
}

export class QuizDto {
  @IsObject() answers!: Record<string, any>;
}
