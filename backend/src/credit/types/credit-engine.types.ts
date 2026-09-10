/**
 * KREDIT Credit Engine — Types canoniques
 * Configurable par pays/produit/montant/durée/dates — jamais en dur.
 */
export type CountryCode = string;
export type ProductType = 'PERSONAL' | 'MORTGAGE' | 'BUSINESS' | 'INVESTMENT';
export type IncomeType = 'SALARY' | 'SELF_EMPLOYED' | 'PENSION' | 'UNEMPLOYMENT' | 'OTHER';
export type EmploymentStatus = 'CDI' | 'CDD' | 'INDEPENDENT' | 'INTERIM' | 'RETIRED' | 'STUDENT' | 'UNEMPLOYED';
export type LoanPurpose = 'VEHICLE' | 'WORKS' | 'CONSUMPTION' | 'DEBT_CONSOLIDATION' | 'MEDICAL' | 'OTHER';
export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'E';
export type Recommendation = 'APPROVE_RECOMMENDATION' | 'REVIEW_RECOMMENDATION' | 'REJECT_RECOMMENDATION';
export interface SimulateInput { amount: number; termMonths: number; monthlyIncome: number; monthlyCharges: number; incomeType: IncomeType; employmentStatus: EmploymentStatus; loanPurpose: LoanPurpose; existingCreditsMonthly?: number; country?: CountryCode; productType?: ProductType; birthDate?: string; }
export interface CreditProduct { id: string; country: CountryCode; type: ProductType; name_i18n: Record<string,string>; minAmount: number; maxAmount: number; minTerm: number; maxTerm: number; isActive: boolean; version: number; effectiveFrom: string; effectiveTo?: string | null; }
export interface RateRule { id: string; country: CountryCode; product: ProductType; minAmount: number; maxAmount: number; minTerm: number; maxTerm: number; baseRate: number; fees: { filePct?: number; fileMin?: number; fileMax?: number; insurancePct?: number }; effectiveFrom: string; effectiveTo?: string | null; }
export interface CreditRule { key: string; value: any; isHard: boolean; category: 'eligibility'|'scoring'|'docs'|'security'; needsLegalValidation?: boolean; country?: CountryCode; product?: ProductType; }
export interface AmortizationLine { month: number; payment: number; interest: number; principal: number; balance: number; }
export interface SimulationResult { monthlyPayment: number; annualRate: number; taeg: number; totalInterest: number; fees: { file: number; insurance: number; total: number }; totalCost: number; schedule: AmortizationLine[]; disclaimer: string; meta: { country: CountryCode; product: ProductType; rateRuleId: string; generatedAt: string }; }
export interface RuleFailure { rule: string; message: string; threshold?: number; value?: number; isHard: boolean; }
export interface EligibilityResult { isEligible: boolean; hardFailures: RuleFailure[]; softFailures: RuleFailure[]; debtRatio: number; repaymentCapacity: number; maxAllowedAmount: number | null; }
export interface ScoringResult { value: number; grade: ScoreGrade; breakdown: Record<string, number>; explanation: string; }
export interface Warning { code: string; message: string; severity: 'low'|'medium'|'high'; i18nKey?: string; }
export interface RequiredDocument { code: string; label: string; label_i18n?: Record<string,string>; required: boolean; reason?: string; }
export interface CreditEngineOutput { simulation: SimulationResult; eligibility: EligibilityResult; score: ScoringResult; recommendation: Recommendation; warnings: Warning[]; requiredDocuments: RequiredDocument[]; }
