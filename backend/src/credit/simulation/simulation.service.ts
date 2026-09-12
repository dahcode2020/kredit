import { BadRequestException, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { tauxPour } from '../rules/grille.commerciale';
/**
 * Moteur de simulation de la route de démo — pur, sans état.
 * Le taux n'est plus « par défaut »: il vient du même palier de montant que la règle validée par
 * `CreditEngineService` (`grille.commerciale.ts`). Un montant hors grille est une erreur explicite,
 * plus un 3,99 % silencieusement prêté à un emprunteur qui n'existe pas dans la grille.
 */
@Injectable()
export class SimulationService {
  simulate(dto: { amount: number; termMonths: number; productType?: string; country?: string }) {
    // Le taux vient de la grille par paliers, plus d'un ternaire par produit. Ce service est celui
    // exposé par POST /api/v1/simulation: pendant qu'il gardait ses 3,25/3,99/4,50 en dur, la grille
    // validée par CreditEngineService était ignorée ici — deux taux différents sur deux endpoints.
    const annual = tauxPour(dto.amount);
    if (annual === null) {
      throw new BadRequestException({ code: 'HORS_GRILLE', message: `Aucun palier de taux pour ${dto.amount} EUR (grille BE: 1 500 EUR à 30 000 000 EUR)` });
    }
    const r = new Decimal(annual).div(12);
    const principal = new Decimal(dto.amount);
    const n = dto.termMonths;
    // mensualité française
    const monthly = r.isZero() ? principal.div(n) : principal.mul(r).div(new Decimal(1).minus(new Decimal(1).plus(r).pow(-n)));
    const total = monthly.mul(n);
    const interest = total.minus(principal);
    // schedule preview 12
    let bal = principal;
    const schedule = [];
    for (let i=1;i<=Math.min(n,12);i++) {
      const inter = bal.mul(r);
      const princ = Decimal.min(monthly.minus(inter), bal);
      bal = Decimal.max(new Decimal(0), bal.minus(princ));
      schedule.push({ month:i, interest: inter.toNumber(), principal: princ.toNumber(), balance: bal.toNumber(), payment: monthly.toNumber() });
    }
    return {
      monthly: monthly.toNumber(),
      total: total.toNumber(),
      totalInterest: interest.toNumber(),
      taeg: annual,
      schedule,
      disclaimer: "Simulation indicative uniquement — ne constitue pas une offre ferme. Décision soumise à validation administrative.",
      meta: { simulationOnly: true, country: dto.country ?? 'BE', currency: 'EUR' }
    };
  }
}
