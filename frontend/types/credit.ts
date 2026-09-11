export type ProductType = "PERSONAL"|"MORTGAGE"|"BUSINESS"|"INVESTMENT";
export type ApplicationStatus = "DRAFT"|"SUBMITTED"|"KYC_PENDING"|"SCORING"|"PENDING_REVIEW"|"MORE_INFO_REQUESTED"|"DECIDED_APPROVED"|"DECIDED_REJECTED"|"DECIDED_CONDITIONAL"|"PENDING_SUPER_REVIEW"|"DISBURSED";
export type SimulateResponse = { monthly:number; taeg:number; total:number; schedule:any[]; disclaimer:string };
