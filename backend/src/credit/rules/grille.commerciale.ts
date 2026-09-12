/**
 * Grille commerciale BE — la seule source des taux et des bornes, côté serveur.
 *
 * Pourquoi un fichier séparé: cette grille vivait en QUATRE exemplaires (les `rateRules` de
 * `RulesService`, le ternaire `productType === 'MORTGAGE' ? 0.0325 : …` de deux `SimulationService`,
 * et le miroir frontend `lib/credit-engine.ts`). Trois d'entre eux pouvaient rester cohérents pendant
 * que le quatrième annonçait un taux périmé sur `/api/v1/simulation` — et `SimulationService` ne
 * lisait même pas la règle que `CreditEngineService` venait de valider.
 *
 * Les règles de taux sont GÉNÉRÉES (croix produits × paliers), comme côté frontend: ajouter un produit
 * ou changer une borne met la grille à jour toute seul, y compris les identifiants sortis dans
 * `meta.rateRuleId` et le journal d'audit.
 *
 * Miroir exact de `frontend/lib/credit-engine.ts` — vérifié par
 * `frontend/tests/unit/credit-tiers.spec.ts`, qui compare les deux fichiers texte à texte.
 */

export type Frais = { filePct: number; fileMin: number; fileMax: number };

export type Produit = {
  code: 'PERSONAL' | 'MORTGAGE' | 'BUSINESS' | 'INVESTMENT';
  min: number;
  max: number;
  minTerm: number;
  maxTerm: number;
  pas: number;
  frais: Frais;
};

/** Palier de taux, par montant emprunté. Les bornes sont des entiers fermés et s'enchaînent à 1 près. */
export const PALIERS_TAUX = [
  { min: 1_500, max: 50_000, taux: 0.025 },
  { min: 50_001, max: 500_000, taux: 0.019 },
  { min: 500_001, max: 1_000_000, taux: 0.018 },
  { min: 1_000_001, max: Infinity, taux: 0.015 },
];

export const PRODUITS: Record<Produit['code'], Produit> = {
  PERSONAL:   { code: 'PERSONAL',   min: 1_500,   max: 200_000,    minTerm: 12, maxTerm: 84,  pas: 250,    frais: { filePct: 0.01,  fileMin: 75,  fileMax: 400 } },
  MORTGAGE:   { code: 'MORTGAGE',   min: 20_000,  max: 1_000_000,  minTerm: 60, maxTerm: 300, pas: 5_000,  frais: { filePct: 0.005, fileMin: 200, fileMax: 1000 } },
  BUSINESS:   { code: 'BUSINESS',   min: 20_000,  max: 3_000_000,  minTerm: 12, maxTerm: 120, pas: 10_000, frais: { filePct: 0.015, fileMin: 150, fileMax: 1500 } },
  INVESTMENT: { code: 'INVESTMENT', min: 200_000, max: 30_000_000, minTerm: 24, maxTerm: 240, pas: 50_000, frais: { filePct: 0.01,  fileMin: 300, fileMax: 5000 } },
};

export const CODES_PRODUIT = Object.keys(PRODUITS) as Produit['code'][];

/** Palier applicable à un montant, ou `null` hors grille (sous 1 500 €, ou montant non entier à une jointure). */
export function palierPour(montant: number) {
  return PALIERS_TAUX.find((p) => montant >= p.min && montant <= p.max) ?? null;
}

/** Taux nominal applicable à un montant. */
export function tauxPour(montant: number): number | null {
  const palier = palierPour(montant);
  return palier ? palier.taux : null;
}

/** Taux le plus bas atteignable pour un produit (le « dès x % » des vitrines). */
export function tauxMiniProduit(code: Produit['code']): number {
  const p = PRODUITS[code];
  return Math.min(...PALIERS_TAUX.filter((b) => b.min <= p.max && (b.max === Infinity || b.max >= p.min)).map((b) => b.taux));
}

/** Date d'effet de la grille: l'ancienne version reste en base (`effective_to`), jamais écrasée. */
export const EFFECTIF_DEPUIS = '2026-09-12';

export type RegleTaux = {
  id: string;
  country: string;
  product: Produit['code'];
  minAmount: number;
  maxAmount: number;
  minTerm: number;
  maxTerm: number;
  baseRate: number;
  fees: Frais;
  effectiveFrom: string;
};

/** Croix produits × paliers, bornées à l'intersection des deux. */
export function genererReglesTaux(pays = 'BE'): RegleTaux[] {
  const regles: RegleTaux[] = [];
  for (const code of CODES_PRODUIT) {
    const p = PRODUITS[code];
    for (const b of PALIERS_TAUX) {
      if (b.min > p.max) continue;
      const plafond = b.max === Infinity ? p.max : Math.min(b.max, p.max);
      const plancher = Math.max(b.min, p.min);
      if (plancher > plafond) continue;
      regles.push({
        id: `rate_${pays}_${code}_${plancher}_${plafond}`,
        country: pays,
        product: code,
        minAmount: plancher,
        maxAmount: plafond,
        minTerm: p.minTerm,
        maxTerm: p.maxTerm,
        baseRate: b.taux,
        fees: { ...p.frais },
        effectiveFrom: EFFECTIF_DEPUIS,
      });
    }
  }
  return regles;
}
