// Frontend mirror of backend CreditEngine — 100% configurable via same rules (BE defaults)
import Decimal from "decimal.js";
export type IncomeType = "SALARY"|"SELF_EMPLOYED"|"PENSION"|"UNEMPLOYMENT"|"OTHER";
export type EmploymentStatus = "CDI"|"CDD"|"INDEPENDENT"|"INTERIM"|"RETIRED"|"STUDENT"|"UNEMPLOYED";
export type LoanPurpose = "VEHICLE"|"WORKS"|"CONSUMPTION"|"DEBT_CONSOLIDATION"|"MEDICAL"|"OTHER";
export interface SimulateInput { amount: number; termMonths: number; monthlyIncome: number; monthlyCharges: number; incomeType: IncomeType; employmentStatus: EmploymentStatus; loanPurpose: LoanPurpose; existingCreditsMonthly?: number; country?: string; productType?: string; birthDate?: string; }
const rateRules = [
  { id:'rate_BE_PERSONAL_1500_10000', country:'BE', product:'PERSONAL', minAmount:1500, maxAmount:10000, minTerm:12, maxTerm:60, baseRate:0.0499, fees:{filePct:0.01, fileMin:75, fileMax:200}},
  { id:'rate_BE_PERSONAL_10001_25000', country:'BE', product:'PERSONAL', minAmount:10001, maxAmount:25000, minTerm:12, maxTerm:72, baseRate:0.0399, fees:{filePct:0.01, fileMin:75, fileMax:300}},
  { id:'rate_BE_PERSONAL_25001_50000', country:'BE', product:'PERSONAL', minAmount:25001, maxAmount:50000, minTerm:12, maxTerm:84, baseRate:0.0449, fees:{filePct:0.01, fileMin:75, fileMax:400}},
  { id:'rate_BE_MORTGAGE_ALL', country:'BE', product:'MORTGAGE', minAmount:50000, maxAmount:500000, minTerm:60, maxTerm:300, baseRate:0.0325, fees:{filePct:0.005, fileMin:200, fileMax:1000}},
  { id:'rate_BE_BUSINESS_ALL', country:'BE', product:'BUSINESS', minAmount:5000, maxAmount:250000, minTerm:12, maxTerm:120, baseRate:0.045, fees:{filePct:0.015, fileMin:150, fileMax:1500}},
];
export function findRateRule(country:string, product:string, amount:number, term:number){ const c = rateRules.filter(r=> r.country===country && r.product===product && amount>=r.minAmount && amount<=r.maxAmount && term>=r.minTerm && term<=r.maxTerm); if(!c.length) return null; return c[0]; }
export function simulateCredit(input: SimulateInput){
  const country = (input.country||'BE').toUpperCase();
  let product = input.productType || (input.amount>=50000?'MORTGAGE': input.amount>=25000?'BUSINESS':'PERSONAL');
  const rule = findRateRule(country, product, input.amount, input.termMonths);
  if(!rule) throw new Error(`Aucune grille ${country} ${product} ${input.amount}€/${input.termMonths}m`);
  const P = new Decimal(input.amount);
  const n = input.termMonths;
  const annual = new Decimal(rule.baseRate);
  const r = annual.div(12);
  const monthly = r.isZero()? P.div(n) : P.mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)));
  const total = monthly.mul(n);
  const interest = total.minus(P);
  let fileFee = P.mul(rule.fees.filePct||0);
  if(fileFee.lt(rule.fees.fileMin||0)) fileFee = new Decimal(rule.fees.fileMin||0);
  if(fileFee.gt(rule.fees.fileMax||1e9)) fileFee = new Decimal(rule.fees.fileMax||1e9);
  if((rule.fees.filePct||0)===0 && (rule.fees.fileMin||0)===0) fileFee = new Decimal(0);
  const cappedFees = Decimal.min(fileFee, P.mul(0.1));
  const totalCost = total.plus(cappedFees);
  const taeg = annual.plus(cappedFees.div(P).div(n/12));
  const schedule: any[]=[]; let bal=P;
  for(let i=1;i<=n;i++){ const inter=bal.mul(r); const princ=Decimal.min(monthly.minus(inter), bal); bal=Decimal.max(new Decimal(0), bal.minus(princ)); schedule.push({month:i, payment:Number(monthly.toFixed(2)), interest:Number(inter.toFixed(2)), principal:Number(princ.toFixed(2)), balance:Number(bal.toFixed(2))}); }
  const monthlyPayment = Number(monthly.toFixed(2));
  const existing = input.existingCreditsMonthly||0;
  const debtRatio = input.monthlyIncome>0? (monthlyPayment+existing+input.monthlyCharges)/input.monthlyIncome : Infinity;
  const capacity = input.monthlyIncome - input.monthlyCharges - existing - monthlyPayment;
  const maxDebt = 0.33;
  const isOverDebt = debtRatio>maxDebt;
  const hardDebt = debtRatio>0.55;
  const maxAmount = product==='MORTGAGE'?500000: product==='BUSINESS'?250000:50000;
  const hardExceed = input.amount>maxAmount;
  const isEligible = !hardExceed && !hardDebt && !(input.birthDate && (()=>{ const b=new Date(input.birthDate!); const now=new Date(); let a=now.getFullYear()-b.getFullYear(); const m=now.getMonth()-b.getMonth(); if(m<0||(m===0&&now.getDate()<b.getDate()))a--; return a<18; })());
  const weights={debtRatio:35, incomeStability:25, employment:20, purpose:10, term:10} as any;
  const debtScore = debtRatio<=0.33?weights.debtRatio: debtRatio<=0.40?Math.round(weights.debtRatio*0.57): debtRatio<=0.50?Math.round(weights.debtRatio*0.22):0;
  const incomeMap:any={SALARY:1, PENSION:0.8, SELF_EMPLOYED:0.6, OTHER:0.4, UNEMPLOYMENT:0.14};
  const empMap:any={CDI:1, RETIRED:0.8, INDEPENDENT:0.7, CDD:0.6, INTERIM:0.45, STUDENT:0.3, UNEMPLOYED:0};
  const purposeMap:any={VEHICLE:1, WORKS:1, CONSUMPTION:0.7, MEDICAL:0.7, OTHER:0.6, DEBT_CONSOLIDATION:0.3};
  const incomeStability = Math.round(weights.incomeStability*(incomeMap[input.incomeType]??0.4));
  const employment = Math.round(weights.employment*(empMap[input.employmentStatus]??0.3));
  const purpose = Math.round(weights.purpose*(purposeMap[input.loanPurpose]??0.6));
  const maxTerm = product==='MORTGAGE'?300: product==='BUSINESS'?120:84;
  const termRatio = n/maxTerm;
  const termScore = termRatio<=0.5?weights.term : termRatio<=0.8? Math.round(weights.term*0.5): Math.round(weights.term*0.2);
  const value = debtScore+incomeStability+employment+purpose+termScore;
  const grade = value>=80?'A': value>=65?'B': value>=45?'C': value>=25?'D':'E';
  let recommendation: 'APPROVE_RECOMMENDATION'|'REVIEW_RECOMMENDATION'|'REJECT_RECOMMENDATION' = 'REVIEW_RECOMMENDATION';
  if(!isEligible || hardDebt || hardExceed || grade==='E') recommendation='REJECT_RECOMMENDATION';
  else if((grade==='A'||grade==='B') && debtRatio<=0.33 && capacity>500) recommendation='APPROVE_RECOMMENDATION';
  else if(grade==='C'||grade==='D'|| isOverDebt) recommendation='REVIEW_RECOMMENDATION';
  const warnings: any[]=[];
  if(debtRatio>0.33) warnings.push({code:'DEBT_RATIO_HIGH', message:`Endettement ${(debtRatio*100).toFixed(1)}% >33%`, severity:'high'});
  if(debtRatio>0.50) warnings.push({code:'OVER_INDEBTED', message:'Surendettement >50%', severity:'high'});
  if(capacity<500) warnings.push({code:'LOW_CAPACITY', message:`Capacité ${capacity.toFixed(0)}€ <500€`, severity:'medium'});
  if(input.amount>0.9*maxAmount) warnings.push({code:'AT_CEILING', message:'Proche plafond', severity:'low'});
  const baseDocs = product==='MORTGAGE'?['ID','INCOME_3M','PROOF_ADDRESS','PROPERTY_VALUATION','BANK_STATEMENTS_3M']: product==='BUSINESS'?['ID','INCOME_3M','PROOF_ADDRESS','TAX_RETURN_2Y','BUSINESS_PLAN']:['ID','INCOME_3M','PROOF_ADDRESS'];
  const requiredDocuments: any[] = baseDocs.map(code=> ({code, label: code, required:true}));
  if(input.amount>20000 && !baseDocs.includes('BANK_STATEMENTS_3M')) requiredDocuments.push({code:'BANK_STATEMENTS_3M', label:'Extraits 3 mois', required:true});
  if(input.incomeType==='SELF_EMPLOYED' && !baseDocs.includes('TAX_RETURN_2Y')) requiredDocuments.push({code:'TAX_RETURN_2Y', label:'Avertissements 2 ans', required:true});
  return {
    simulation:{ monthlyPayment, annualRate: rule.baseRate, taeg: Number(taeg.toFixed(4)), totalInterest: Number(interest.toFixed(2)), fees:{file:Number(fileFee.toFixed(2)), insurance:0, total:Number(cappedFees.toFixed(2))}, totalCost: Number(totalCost.toFixed(2)), schedule, disclaimer:"Simulation indicative — ne constitue pas une offre ferme. Décision humaine obligatoire.", meta:{country, product, rateRuleId: rule.id, generatedAt: new Date().toISOString()}},
    eligibility:{ isEligible, hardFailures: hardExceed?[{rule:'max_amount', message:`>${maxAmount}`}] : hardDebt?[{rule:'max_debt_hard'}]: [], softFailures: isOverDebt?[{rule:'max_debt_ratio'}]:[], debtRatio: Number(debtRatio.toFixed(4)), repaymentCapacity: Number(capacity.toFixed(2)), maxAllowedAmount: isOverDebt? Math.floor((input.monthlyIncome*0.33-input.monthlyCharges-existing)*input.termMonths*0.9): null },
    score:{ value, grade, breakdown:{debtRatio:debtScore, incomeStability, employment, purpose, term:termScore}, explanation:`Score ${value} grade ${grade}, dette ${(debtRatio*100).toFixed(1)}%` },
    recommendation, warnings, requiredDocuments,
  };
}
