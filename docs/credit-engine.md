# KREDIT — Moteur Complet de Crédit (v1.0)
## Simulation indicative → Éligibilité → Scoring → Recommandation (décision humaine)

> **Règle d'or:** Simulation ≠ offre ferme. Recommandation ≠ décision bancaire. Tout taux/plafond/règle est configurable par pays/produit/montant/durée/dates — jamais en dur.

---

## 1. Architecture

```
                ┌─────────────┐
                │ CreditProduct│  (BE, PERSONAL, 1 500-50 000€, 12-84m, active, v3)
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │  RateRule    │  bande (amount×term×product×country×dates) → baseRate + fees
                └──────┬──────┘
                       │
Client ── DTO ──►┌─────▼─────┐   ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
(8 champs)       │Simulation │──►│Eligibility   │─►│Scoring      │─►│Decision     │
                 │Engine     │   │Engine        │  │Engine       │  │Engine       │
                 │(pur)      │   │(règles hard │  │(grade A-E)  │  │(APPROVE/    │
                 │monthly/   │   │ + soft)     │  │+ debt/capac.│  │ REVIEW/     │
                 │taeg/total │   │             │  │             │  │ REJECT)     │
                 └─────┬─────┘   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
                       │                │                │                │
                       └────────────────┴────────────────┴────────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │CreditEngine │ orchestrateur (facade)
                                    └──────┬──────┘
```

**Modules:** `backend/src/credit/{products,rules,simulation,eligibility,scoring,decision-engine,schedules,applications,repayments}` — voir §7 docs/architecture-technique.md

---

## 2. Entrées / Sorties

### 2.1 DTO entrée (8 champs minimaux)

```ts
POST /api/v1/credit/simulations
{
  amount: 15000,
  termMonths: 48,
  monthlyIncome: 3200,
  monthlyCharges: 900,
  incomeType: "SALARY",
  employmentStatus: "CDI",
  loanPurpose: "VEHICLE",
  existingCreditsMonthly: 250,
  country?: "BE",
  productType?: "PERSONAL",
  birthDate?: "1990-04-12"
}
```

Enums: `IncomeType = SALARY|SELF_EMPLOYED|PENSION|UNEMPLOYMENT|OTHER`, `EmploymentStatus = CDI|CDD|INDEPENDENT|INTERIM|RETIRED|STUDENT|UNEMPLOYED`, `LoanPurpose = VEHICLE|WORKS|CONSUMPTION|DEBT_CONSOLIDATION|MEDICAL|OTHER`

### 2.2 Sortie canonique

```ts
{
  simulation: { monthlyPayment, annualRate, taeg, totalInterest, fees, totalCost, schedule, disclaimer, meta },
  eligibility: { isEligible, hardFailures, softFailures, debtRatio, repaymentCapacity, maxAllowedAmount },
  score: { value:62, grade:"C", breakdown, explanation },
  recommendation: "REVIEW_RECOMMENDATION", // APPROVE | REVIEW | REJECT
  warnings: [{code:"DEBT_RATIO_HIGH", ...}],
  requiredDocuments: [{code:"ID", label:"Carte d'identité", required:true}]
}
```

---

## 3. Configurabilité

**CreditProduct** BE: `minAmount 1500 max 50000 minTerm12 max84 version3 effectiveFrom 2026-01-01`

**RateRule** bande: `minAmount/maxAmount/minTerm/maxTerm/baseRate 0.0399 fees {filePct 0.01 fileMin75 fileMax300} effectiveFrom`

Moteur choisit bande `contains(amount,term)` + `max(effectiveFrom)`. Si aucune → `NO_RATE_RULE`.

**CreditRule** exemples:
`{key:"max_debt_ratio", value:0.33, isHard:false, country:"BE", needsLegalValidation:true}`
`{key:"min_age", value:18, isHard:true}`

Lecture via `RulesService.getActive(country,product)` cache Redis 5m.

---

## 4. Algorithmes

**Simulation (French):** `r=annual/12; monthly = r==0?P/n : P*r/(1-(1+r)^-n); total=monthly*n; interest=total-P; fees=capped; taeg≈annual+fees/P/(n/12); schedule loop`

**Éligibilité:** `debtRatio=(monthly+existing+charges)/income; capacity=income-charges-existing-monthly; hardFailures (maxAmount, min_age, debt>55%); softFailures (debt>33%, min_income)`

**Scoring 0-100 → grade A(80) B65 C45 D25 E:**
- debtRatio 35pts: 0-33%→35, 33-40→20, 40-50→8, >50→0
- incomeStability 25: SALARY25 CDD18 INDEPENDENT15 etc
- employment 20, purpose 10, termRisk 10

**Décision:** `if hard → REJECT; else if E or debt>50 → REJECT; else if C/D or debt>33 or soft → REVIEW; else if A/B && debt≤33 && capacity>500 → APPROVE else REVIEW`

**Documents:** `required_docs_{PRODUCT}` + si amount>20k → BANK_STATEMENTS_3M, si SELF_EMPLOYED → TAX_RETURN_2Y, si debt>40% → DEBT_DETAILS

---

## 5. Interfaces TS

Voir `backend/src/credit/types/credit-engine.types.ts`

---

## 6. Validation & cas limites

DTO class-validator: amount 500-500000, term 6-360, income 0-100k, charges ≤90% income, country in [BE,FR...], birthDate âge≥18. Tableau cas limites dans doc.

---

## 7. Services NestJS

`CreditEngineService.simulate(input)` orchestre 5 engines. `CreditController POST /credit/simulations` (public, rate-limited).

---

## 8. Tests

`backend/src/credit/__tests__/credit-engine.spec.ts` — 10 tests (simulation, debt, max_amount, approve, review, reject, NO_RATE_RULE, docs, age, configurable). `npx jest --no-coverage`

---

## 9. Exemples chiffrés

**Ex1 15k 48m CDI 3200/900 existing250 VEHICLE:** monthly338 taeg4.21 debt38.4% score58 C → REVIEW + `maxAllowed≈9800`

**Ex2 même income5000 charges800:** debt22.7% score82 A → APPROVE

**Ex3 SELF_EMPLOYED 1000/600 20k 60m:** debt>50% → REJECT + TAX_RETURN_2Y

Tous avec schedule complet + disclaimer.
