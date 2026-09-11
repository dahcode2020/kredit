# KREDIT — Module Investissement (générique, régulé)

> Produits génériques multi-pays — risque 1-7 — jamais de rendement garanti affiché sans garantie légale/contractuelle — contrôles réglementaires bloquants avant souscription — restrictions pays/type d’investisseur/produit configurables.

---

## 1. Principes

- **Générique** : un seul modèle `investment_products` sert tous types (obligation, fonds, dépôt à terme, compte épargne, tokenisé futur) via `type`, `yield_method`, `config JSONB`. Ajouter un type = ligne, pas de code.
- **Séparation crédit/investissement** : bounded contexts distincts pour éviter requalification bancaire. Même auth, même audit, mais pas de croisement de fonds.
- **Risque central** : chaque produit a `risk_level 1-7` (PRIIPs) + `risk_factors JSONB`. **Disclaimer perte en capital** omniprésent si `capital_guaranteed=false`.
- **Jamais de rendement garanti affiché** si `is_capital_guaranteed=false` ou `guarantee_details` non validé juridiquement. Front bloque `yield_display` si `guarantee_status != 'VALIDATED'`.
- **Restrictions configurables** : matrice `investment_restrictions(country, investor_type, product_type, min_amount)` + `investment_eligibility` service. Un pays peut interdire un produit, un type d’investisseur (retail vs pro) peut être restreint.
- **Contrôles bloquants** : `KYC VERIFIED` + `suitability quiz` (MiFID-like) + `risk tolerance` + `plafonds pays` + `documents` doivent être `CLEAR` avant `SUBSCRIBED`. `needs_legal_validation` sur tout produit.

---

## 2. Produit — champs

| Champ | Type | Exemple |
|-------|------|---------|
| `id` | UUID PK | |
| `code` | TEXT UNIQUE | `BE_GREEN_BOND_2031` |
| `name_i18n` | JSONB | `{"fr":"Obligation verte BE 2031","en":"BE Green Bond 2031"}` |
| `description_i18n` | JSONB | |
| `type` | `investment_product_type` | `BOND`, `FUND`, `TERM_DEPOSIT`, `SAVINGS`, `EQUITY` |
| `country_code` | CHAR(2) FK | `BE` (extensible) |
| `currency` | CHAR(3) | `EUR` (MVP) |
| `min_amount` | NUMERIC(15,2) | `5000` |
| `max_amount` | NUMERIC(15,2) nullable | `100000` |
| `term_months` | INT nullable | `60` (null = ouvert) |
| `yield_method` | TEXT | `FIXED`, `VARIABLE`, `FORMULA` |
| `yield_config` | JSONB | `{"fixed_rate":0.021, "formula":"EURIBOR+1.2%"}` |
| `risk_level` | INT 1-7 | `3` |
| `risk_factors` | JSONB | `["taux","crédit","liquidité"]` |
| `capital_guaranteed` | BOOLEAN | `false` (si `true` → `guarantee_details` obligatoire) |
| `guarantee_details` | JSONB nullable | `{"guarantor":"État belge","type":"100% capital","validated_by_legal_at":null}` |
| `status` | `investment_product_status` | `DRAFT/ACTIVE/SUSPENDED/CLOSED` |
| `total_subscribed` | NUMERIC | agrégat |
| `max_total` | NUMERIC nullable | plafond émission |
| `available_from/to` | TIMESTAMPTZ | fenêtre |
| `documents` | JSONB | `[{code:'PROSPECTUS', url:'s3://...'}]` i18n |
| `config` | JSONB | restrictions fines |
| `needs_legal_validation` | BOOLEAN | `true` par défaut |
| `validated_by_legal_at` | TIMESTAMPTZ | null = bannière amber |

**Statuts** : `DRAFT` (admin prépare) → `ACTIVE` (visible/souscriptible) → `SUSPENDED` (gel temporaire, pas de nouvelle souscription) → `CLOSED` (échéance ou plafond atteint).

---

## 3. Client — parcours

```
Consultation (catalogue filtré pays/devise/risque) → Fiche produit (rendement indicatif + disclaimer) → Quiz adéquation → Vérif éligibilité (pays/type) → Souscription (montant) → Paiement (PaymentService) → Position (portefeuille) → Historique/rendement/transactions/documents
```

| Étape | Contrôle | Bloquant |
|-------|----------|----------|
| **Consultation** | `product.status=ACTIVE` + `country_code` + `available_from/to` | filtre |
| **Investissement** | `amount >= min_amount` && `<= max_amount` && `total_subscribed+amount <= max_total` | oui |
| **Portefeuille** | `investment_positions` agrégées | lecture |
| **Historique** | `investment_transactions` | lecture |
| **Rendement** | calcul `yield_method` indicatif uniquement, jamais garanti si `!capital_guaranteed` | affichage conditionnel |
| **Transactions** | `SUBSCRIBED, DIVIDEND, REDEMPTION, FEES` | audit |
| **Documents** | prospectus, DIC PRIIPs, relevés | S3 présigné |

---

## 4. Admin — gestion

| Action | Rôle | Effet |
|--------|------|-------|
| **Création** | `SUPER_ADMIN` | `DRAFT` + `needs_legal_validation=true` |
| **Modification** | `SUPER_ADMIN` | versionne `config`/`yield` (effective_from) |
| **Activation** | `SUPER_ADMIN` | `DRAFT → ACTIVE` si `validated_by_legal_at` non null |
| **Suspension** | `ADMIN`/`SUPER_ADMIN` | `ACTIVE → SUSPENDED` + motif audit |
| **Clôture** | `SUPER_ADMIN` | `ACTIVE/SUSPENDED → CLOSED` (échéance ou plafond) |
| **Suivi montants** | `ADMIN` lecture | `total_subscribed`, `remaining = max_total - total_subscribed` |
| **Suivi investisseurs** | `ADMIN` lecture | `positions` par `customer_id`, `pays`, `type` |

---

## 5. Restrictions — pays / type d’investisseur / produit

**Tables** `investment_restrictions` + `investor_profiles` :

```sql
investment_restrictions(country_code, investor_type, product_type, allowed BOOLEAN, min_amount NUMERIC, max_amount NUMERIC, requires_accreditation BOOLEAN)
investor_profiles(customer_id UNIQUE, type ENUM('RETAIL','PROFESSIONAL','ELIGIBLE_COUNTERPARTY'), risk_tolerance 1-7, accreditation_verified_at, suitability_score)
```

**Éligibilité** (`InvestmentEligibilityService`) :

```ts
canSubscribe({customerId, productId}):
  - product.country_code == customer.country || allowed cross-border?
  - product.status == ACTIVE
  - amount dans [min_amount, max_amount] global + restriction spécifique (ex: BE RETAIL + BOND max 50k)
  - investor.type == RETAIL && product.type == EQUITY → allowed=false si config
  - requires_accreditation && !profile.accreditation_verified_at → REJECT
  - risk_level > profile.risk_tolerance → REJECT ou WARNING + confirmation explicite
```

Exemple : `BE, RETAIL, BOND → allowed true, max 100k` / `BE, RETAIL, EQUITY → allowed false (besoin PRO)`.

---

## 6. Rendement — jamais garanti sans base légale

```ts
function displayYield(product, locale):
  if (!product.capital_guaranteed || !product.guarantee_details?.validated_by_legal_at)
    return { text: t(locale, 'investment:yield.indicative', {rate: product.yield_config.fixed_rate}), disclaimer: t(locale, 'legal:disclaimer.investment') };
  else
    return { text: t(locale, 'investment:yield.guaranteed', {rate}), guarantee: product.guarantee_details.guarantor };
```

Front : si `!capital_guaranteed` affiche bandeau rouge `Risque de perte en capital` + `legal:disclaimer.investment` + pas de `isGuaranteed` badge.

---

## 7. Contrôles réglementaires avant souscription (bloquants)

| Contrôle | Source | Bloquant |
|----------|--------|----------|
| `KYC VERIFIED` | `kyc_verifications` | oui |
| `Suitability quiz` MiFID-like (connaissance/expérience, objectifs, capacité perte) | `investor_profiles.suitability_score` + `risk_tolerance` | oui si `score < threshold` |
| `Adéquation risque` `product.risk_level <= profile.risk_tolerance` ou confirmation explicite | `InvestmentEligibilityService` | oui |
| `Pays/type` | `investment_restrictions` | oui |
| `Plafonds` | `product` + `restrictions` | oui |
| `Documents` PRIIPs/DIC lus (case à cocher) | `investment_subscriptions.documents_ack` | oui |
| `needs_legal_validation` produit | `validated_by_legal_at` | oui → bannière |
| `Âge` `>=18` | `customers` | oui |
| `Sanctions/PEP` si applicable | `amlProvider` | oui si HIT |

Si un contrôle échoue → `REJECT` avec `reasons[]` i18n, pas de `SUBSCRIBED`.

---

## 8. Modèle — portefeuille & transactions

```sql
investment_products (id, code, type, country_code, currency, min_amount, ...)
investment_positions (id, customer_id, product_id, amount_subscribed, amount_current, subscribed_at, status ACTIVE/REDEEMED)
investment_transactions (id, position_id, type SUBSCRIBED/DIVIDEND/REDEMPTION/FEES/REFUND, amount, status PENDING/SUCCEEDED/FAILED, provider_payment_id, created_at)
investment_restrictions (country_code, investor_type, product_type, allowed, min/max, requires_accreditation)
investor_profiles (customer_id UNIQUE, type, risk_tolerance, suitability_score, accreditation_verified_at)
```

---

## 9. Flux technique

```
[Client] POST /investments/:productId/subscribe {amount, idempotencyKey, riskConfirm, docsAck}
  → InvestmentSubscriptionService.subscribe() → vérif KYC + suitability + restrictions + plafonds + docsAck + legal
  → INSERT investment_positions PENDING + investment_transactions PENDING
  → PaymentService.create() (type FEES ou SUBSCRIPTION) → PROCESSING
  → webhook Payment SUCCEEDED → position ACTIVE, transaction SUCCEEDED → audit → notification
  → cron rendement → calcul indicatif (pas de garantie)
```

---

## 10. API

```
GET    /api/v1/investments/products?country=BE&type=BOND&risk_lte=3
GET    /api/v1/investments/products/:id
POST   /api/v1/investments/products (SUPER_ADMIN)
PATCH  /api/v1/investments/products/:id/status {status: SUSPENDED, reason} (SUPER_ADMIN)
POST   /api/v1/investments/:productId/subscribe {amount, idempotencyKey, riskConfirm, docsAck}
GET    /api/v1/investments/portfolio (CUSTOMER)
GET    /api/v1/investments/transactions
GET    /api/v1/admin/investments/positions?productId=
POST   /api/v1/investor-profiles/quiz {answers} → {score, risk_tolerance}
```

---

## 11. À valider juridiquement (BE/UE)

- **MiFID II** : quiz adéquation, catégorisation client, DIC PRIIPs obligatoire avant souscription
- **Prospectus** : dispense <8M€ ? BE FSMA
- **PRIIPs** : KID 1-7 risque, coûts, scénarios
- **Garantie capital** : qui garantit (banque/État/assureur) ? Contrat validé
- **Blanchiment** : même LBC que crédit si montant > seuil
- **Fiscalité** : précompte mobilier BE 30% sur intérêts
- **Hébergement** : données UE, DPA

---

## 12. Checklist

- [x] Migration `investment_products`, `investment_positions`, `investment_transactions`, `investor_profiles`, `investment_restrictions`
- [x] Services `InvestmentEligibilityService`, `InvestmentSubscriptionService` + contrôles bloquants
- [x] Admin CRUD + activation/suspension/clôture + suivi
- [x] Disclaimer perte en capital si `!capital_guaranteed`
- [ ] Validation juridique PRIIPs/KID
- [ ] Intégration PaymentService réel (SEPA)
