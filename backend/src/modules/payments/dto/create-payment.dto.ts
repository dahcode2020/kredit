import { IsString, IsNumber, IsOptional, IsUUID, IsArray, IsEnum } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID() loanId!: string;
  @IsOptional() @IsArray() installmentIds?: string[];
  @IsNumber() amount!: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsEnum(['INSTALLMENT','EARLY_REPAYMENT','FEES','REFUND']) type?: string;
  @IsString() idempotencyKey!: string;
}

export class ConfirmPaymentDto {
  @IsString() reason!: string;
}

export class RefundDto {
  @IsOptional() @IsNumber() amount?: number;
  @IsString() reason!: string;
}
