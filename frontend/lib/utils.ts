import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatEUR(amount: number, locale = "fr-BE") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}
export function formatEUR2(amount: number, locale = "fr-BE") {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

// French amortization (constant monthly payment) — Decimal.js HALF_UP, pas de float
// Règle: frontend ne doit jamais calculer un montant définitif; calcul indicatif local uniquement
// Le total officiel vient du backend (SimulationEngine Decimal). Ce helper sert au simulateur instantané offline.
export function amortize(principal: number, annualTaeg: number, months: number) {
  const P = new Decimal(principal);
  const r = new Decimal(annualTaeg).div(12);
  const monthlyD = r.isZero() ? P.div(months) : P.mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-months)));
  const monthly = Number(monthlyD.toFixed(2));
  const schedule: { month: number; interest: number; principal: number; balance: number; payment: number }[] = [];
  let balance = P;
  for (let i = 1; i <= months; i++) {
    const interestD = balance.mul(r);
    const princD = Decimal.min(monthlyD.minus(interestD), balance);
    balance = Decimal.max(new Decimal(0), balance.minus(princD));
    schedule.push({
      month: i,
      interest: Number(interestD.toFixed(2)),
      principal: Number(princD.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      payment: monthly,
    });
  }
  // dernier solde forcé 0 (corrige arrondi cumulé <0.01)
  if (schedule.length) schedule[schedule.length - 1].balance = 0;
  const total = Number(monthlyD.mul(months).toFixed(2));
  const totalInterest = Number(new Decimal(total).minus(P).toFixed(2));
  return { monthly, total, totalInterest, schedule };
}
export function amortizePrecise(principal: number, annualTaeg: number, months: number) {
  return amortize(principal, annualTaeg, months);
}
