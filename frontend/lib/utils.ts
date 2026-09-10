import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatEUR(amount: number, locale = "fr-BE") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}
export function formatEUR2(amount: number, locale = "fr-BE") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

// French amortization (constant monthly payment)
export function amortize(principal: number, annualTaeg: number, months: number) {
  const r = annualTaeg / 12;
  const monthly = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  const schedule: { month: number; interest: number; principal: number; balance: number; payment: number }[] = [];
  let balance = principal;
  for (let i = 1; i <= months; i++) {
    const interest = balance * r;
    const princ = Math.min(monthly - interest, balance);
    balance = Math.max(0, balance - princ);
    schedule.push({ month: i, interest, principal: princ, balance, payment: monthly });
  }
  const total = monthly * months;
  const totalInterest = total - principal;
  return { monthly, total, totalInterest, schedule };
}
