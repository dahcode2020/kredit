import { IsNumber, IsInt, IsEnum, IsOptional, IsString, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { IncomeType, EmploymentStatus, LoanPurpose, ProductType } from '../types/credit-engine.types';
export class SimulateDto {
  @Type(() => Number) @IsNumber() @Min(500) @Max(500000) amount!: number;
  @Type(() => Number) @IsInt() @Min(6) @Max(360) termMonths!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100000) monthlyIncome!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100000) monthlyCharges!: number;
  @IsEnum(['SALARY','SELF_EMPLOYED','PENSION','UNEMPLOYMENT','OTHER'] as const) incomeType!: IncomeType;
  @IsEnum(['CDI','CDD','INDEPENDENT','INTERIM','RETIRED','STUDENT','UNEMPLOYED'] as const) employmentStatus!: EmploymentStatus;
  @IsEnum(['VEHICLE','WORKS','CONSUMPTION','DEBT_CONSOLIDATION','MEDICAL','OTHER'] as const) loanPurpose!: LoanPurpose;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100000) existingCreditsMonthly?: number = 0;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsEnum(['PERSONAL','MORTGAGE','BUSINESS','INVESTMENT'] as const) productType?: ProductType;
  @IsOptional() @IsDateString() birthDate?: string;
}
