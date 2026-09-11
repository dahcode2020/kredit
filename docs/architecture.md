# KREDIT — Plateforme Européenne de Crédit & Investissement
## Architecture & Plan de Production — Belgique (EUR) — Extensible EU
*Version 1.0 — 2026-09-10 — Architecte Senior — PWA Fintech Européenne*
*Inspiration UI : Dewi (Themewagon) — traduit en design system fintech premium*

---

## 0. Synthèse exécutive & parti-pris

**Vision:** KREDIT n'est pas un simulateur vitrine. C'est une plateforme régulée, auditable, opérée par des humains, où l'automatisation **calcule, contrôle, recommande** mais **ne décide jamais** à la place de l'ADMIN. Toute dérogation est tracée avec motif.

**Principes structurants (non négociables):**
1.  **Configuration > Code dur:** Aucune règle pays / produit / taux / plafond / document / scoring en dur. Tout est en base versionnée + feature flags.
2.  **Human-in-the-loop by design:** État `PENDING_REVIEW` obligatoire. Le moteur propose, l'humain dispose. Pas de `AUTO_APPROVED` sans validation explicite du workflow.
3.  **Simulation ≠ Offre:** Disclaimer légal omniprésent, taux indicatifs, PDF marqué *SIMULATION*.
4.  **Compliance by design:** KYC/AML/antifraude/audit/RGPD dès le jour 1, pas en rattrapage.
5.  **Multi-tenant pays:** Belgique = tenant `BE` par défaut, schéma extensible à FR, NL, DE, LU...
6.  **i18n natif:** FR/EN/NL/DE au niveau DB (jsonb traduisible) + front + emails + PDFs.
7.  **Scalable & observable:** Modulaire, idempotent, queues, logs structurés, tracing.

**Incohérences détectées & arbitrages:**
- *Besoin SUPER_ADMIN vs ADMIN:* séparation stricte; SUPER_ADMIN = seul à toucher taux/règles/pays/intégrations (risque financier & fraude interne). ADMIN ne peut pas s'auto-escalader.
- *“Pas de rôles supplémentaires”* vs besoin technique: on autorise `SYSTEM` et `AUDITOR_READONLY` internes non assignables humainement.
- *3 langues BE officielles (FR/NL/DE) + EN* → on stocke 4 locales, mais pays BE expose FR/NL/DE par défaut; EN = fallback premium.
- *Investments + Credit même plateforme:* séparation fonctionnelle forte pour éviter confusion réglementaire (MiFID vs crédit conso/hypothécaire). Deux bounded contexts distincts, même auth.

---

## 1. Architecture Globale

### 1.1 Vue d'ensemble (C4 - Level 1)
```
[ PWA Next.js ] ←HTTPS→ [ API Gateway (NestJS) ] ←→ [ PostgreSQL (R/W + replica) ]
       ↕                        ↕  ↕  ↕                         ↕
[ Service Worker ]          [ Redis ] [ S3 ] [ Queues/BullMQ ]  [ Audit store append-only ]
       ↕                        ↕
[ Push / WebPush ]         [ Providers: KYC, AML, PSP, Email, SMS, WhatsApp ]
```

### 1.2 Style architectural
- **Monorepo** (`/frontend`, `/backend`, `/packages/shared`) — pnpm workspaces + Turborepo.
- **Modulaire hexagonal:** `domain` (règles pures) / `application` (use-cases) / `infrastructure` (adapters) / `presentation` (controllers). Pas de dépendance domaine → infra.
- **API REST versionnée** (`/api/v1`) + idempotency-key header pour POST sensibles.
- **Event-driven** pour flux longs: BullMQ (Redis) — `kyc.verified`, `scoring.completed`, `decision.required`, `document.uploaded`.
- **Multi-tenant pays:** colonne `country_code` partout (RLS PostgreSQL optionnelle). Config pays chargée au boot & cache Redis 5min.
- **Tenancy config:** `countries` → `products` → `rules` → `rates` → `documents` → `fees`. Hiérarchie versionnée (effective_from / effective_to).

### 1.3 Qualité production
- **PWA:** manifest, service worker (Workbox), offline shell, precache fonds critiques, update prompt.
- **Responsive mobile-first:** Tailwind, container 1280, Dewi-like dark header + red accent.
- **Sécurité:** Helmet, CORS strict, rate-limit (Redis), CSRF, CSP, HttpOnly cookies + JWT court (15min) + refresh rotation.
- **Observabilité:** OpenTelemetry → Loki/Grafana, Sentry, audit trail immuable, métriques Prometheus.
- **Infra:** Docker multi-stage, CI/CD GitHub Actions (lint/test/build/migrate/deploy), blue/green, backups PITR PostgreSQL + S3 versioning.

---

## 2. Architecture Frontend (Next.js 14+ App Router)

### 2.1 Stack
- **Next.js 14 (App Router) + React 18 + TypeScript strict**
- **Tailwind CSS** — design system Dewi adapté fintech: primary `#FF3B30` → `#E8450A` (rouge Dewi), dark `#0F0F0F`, slate, 8px grid, radius 16.
- **PWA:** `next-pwa` / `serwist`, `manifest.json` (FR/EN/NL/DE), icons 192/512, maskable, `theme_color #0F0F0F`.
- **State:** Zustand (UI) + TanStack Query (server state) + React Hook Form + Zod.
- **i18n:** `next-intl` — routage `/[locale]` (fr|en|nl|de), messages en `messages/*.json`, ICU, fallback EN.
- **A11y & SEO:** sémantique, SSR, metadata, sitemap i18n, structured data (FinancialProduct).

### 2.2 Arborescence
```
/app
  /[locale]
    /(public)   → page.tsx (landing Dewi-inspired), simulateur, produits, à-propos, contact, mentions
    /(auth)     → login, register, verify, forgot
    /(customer) → dashboard, applications, documents, repayments, investments, profile, notifications
    /(admin)    → layout (guard ADMIN), dossiers, scoring, decision, clients, paiements
    /(super)    → layout (guard SUPER_ADMIN), config/pays/produits/taux/règles/intégrations/logs
/components
  /ui           → Button, Card, Badge, Input, Table, Modal (Dewi style)
  /layout       → Header, Footer, MobileNav, LanguageSwitcher, Currency (EUR)
  /credit       → Simulator, AmortizationTable, DecisionTimeline
  /kyc          → KYCFlow, DocumentDropzone
/lib
  /api          → fetcher avec auth + idempotency
  /i18n, /pwa, /utils
```

### 2.3 Adaptations Dewi → KREDIT
| Dewi | KREDIT |
|------|--------|
| Hero “PLAN. LAUNCH. GROW.” | “Votre crédit. Votre avenir. En toute confiance.” + simulateur héro |
| Stats 130/292/819 | Encours, Dossiers traités, Taux satisfaction, Délai moyen |
| Featured Services 3 cards | Crédit Personnel / Hypothécaire / Pro + Investissements |
| Clients logos | Partenaires & régulateurs: BNB, FSMA, Febelfin (grisés) |
| Tabs Features | Parcours 4 étapes: Demande → Analyse → Décision humaine → Déblocage |
| Services 6 icon boxes | 6 garanties: Sécurisé, Transparent, Rapide, Conforme, Configurable, Accompagné |
| Testimonials | Avis vérifiés clients BE (avec disclaimer) |
| Portfolio | Ce n'est pas un portfolio: remplacé par “Produits & Tarifs” comparateur |
| Team | Comité & gouvernance (pas de faux profils) |
| Contact + map | Contact + agence Bruxelles + WhatsApp/Email |

### 2.4 Auth & RBAC front
- Middleware Next.js protège `/customer`, `/admin`, `/super` par rôle JWT.
- Guards affichent 403 explicite. SUPER_ADMIN voit bannière “Mode sensible”.
- Toutes actions sensibles demandent re-auth ou OTP si configuré.

---

## 3. Architecture Backend (NestJS - TypeScript - REST)

### 3.1 Modules (bounded contexts)
Chaque module = `controller → service → repository → entity` + `events` + `dto (Zod/class-validator)`.

| Module | Responsabilité | Notes prod |
|---|---|---|
| **Auth** | login, register, JWT, refresh rotation, 2FA optionnelle, lockout | bcrypt 12, Argon2 option, rate-limit 5/min, audit login |
| **Customers** | profil, adresses, consentements RGPD | soft delete, anonymisation |
| **KYC** | collecte identité, vérif doc, statut, providers | statuts: `NOT_STARTED/IN_REVIEW/VERIFIED/REJECTED/EXPIRED` |
| **Countries** | config pays, devise, locales, jours fériés, règles spécifiques | BE par défaut, extensible |
| **Credit / Products** | catalogue produits par pays, plafonds, durées, garanties | versionné, effective_from |
| **Credit Simulation** | calcul indicatif, pas d'engagement | moteur pur, sans persistance obligatoire |
| **Credit Applications** | dossier, workflow, pièces jointes | state machine stricte |
| **Scoring** | score interne, ratios, endettement, recommandations | configurable, pas décisif |
| **Decision Engine** | recommandation AUTO, mais décision finale humaine | `RECOMMENDED_*` vs `DECIDED_*` |
| **Repayment** | échéancier, amortissement français, suivi paiements | calculs décimaux précis (decimal.js) |
| **Investments** | produits investissement, souscription (séparé crédit) | disclaimer risque |
| **Payments** | PSP (Mollie/Stripe), webhooks idempotents, réconciliation | jamais auto-débit sans mandat |
| **Documents** | upload S3 présigné, virus scan, OCR, rétention RGPD | métadonnées chiffrées |
| **Notifications** | orchestrateur → Email (SES/Sendgrid), SMS (Twilio), WhatsApp (Cloud API), Push (WebPush) | templates i18n, préférences user |
| **Admin / Super** | CRUD config, feature flags | audit obligatoire |
| **Audit** | journal append-only, hash chaîné | WORM, export |
| **Security** | antifraude, velocity checks, device fingerprint | règles configurables |

### 3.2 Workflow Demande de Crédit (state machine)
```
DRAFT → SUBMITTED → KYC_PENDING → SCORING → PENDING_REVIEW → (DECIDED_APPROVED|DECIDED_REJECTED|DECIDED_CONDITIONAL)
                                          ↘ EXCEPTIONAL_APPROVAL (avec motif + double validation SUPER_ADMIN si seuil)
SUBMITTED → REJECTED_AUTO (si blocage réglementaire dur, e.g. âge <18) mais traçage
PENDING_REVIEW → MORE_INFO_REQUESTED → SUBMITTED (boucle)
DECIDED_APPROVED → DISBURSED → REPAID | DEFAULTED
```
- Transitions guardées par rôle + règles pays/produit + audit.
- `EXCEPTIONAL_*` exige `exception_reason` + `approved_by` + seuil montant → validation SUPER_ADMIN.

### 3.3 API design (exemples)
- `POST /v1/simulations` → calcul sans auth, retourne échéancier indicatif + disclaimer
- `POST /v1/applications` → auth CUSTOMER, idempotency-key, crée DRAFT
- `POST /v1/applications/:id/submit` → déclenche queue KYC+Scoring
- `GET  /v1/admin/applications?status=PENDING_REVIEW` → ADMIN
- `POST /v1/admin/applications/:id/decision` → ADMIN (body: decision, reason, exception?) → audit
- `PUT  /v1/super/countries/BE/products/:id` → SUPER_ADMIN
- Toutes réponses incluent `requestId`, `meta:{simulationOnly:true}` quand pertinent.

### 3.4 Sécurité backend
- Validation Zod stricte, DTO whitelist, pas de mass assignment.
- RBAC décorateurs `@Roles('ADMIN')`, `@RequireDecisionPermission()`.
- Chiffrement au repos (AES-256 S3), en transit TLS 1.3, secrets Vault/ENV.
- Logs sans PII; audit séparé.

---

## 4. Architecture Base de Données (PostgreSQL 15+)

### 4.1 Principes
- **UUID v7** PK, `created_at`, `updated_at`, `deleted_at` (soft delete).
- **jsonb traducible:** `name_i18n: {fr,en,nl,de}`, `description_i18n`.
- **Versioning configs:** `effective_from`, `effective_to`, `version`, `created_by`.
- **Append-only audit:** `audit_logs` hash-chained (`prev_hash`).
- **Décimaux:** `numeric(15,2)` EUR, `numeric(5,4)` taux.
- **Index:** GIN sur jsonb, B-tree sur `country_code`, `status`.

### 4.2 Schéma principal (simplifié)
```sql
-- Core
users (id, email unique, password_hash, role enum CUSTOMER|ADMIN|SUPER_ADMIN, locale, is_active, last_login, ...)
customers (id FK users, country_code FK countries, kyc_status, risk_level, consent_rgpd_at, ...)
countries (code PK 'BE', currency 'EUR', locales ['fr','nl','de'], is_active, config jsonb, ...)
products (id, country_code, type enum PERSONAL|MORTGAGE|BUSINESS|INVESTMENT, name_i18n, min_amount, max_amount, min_term, max_term, is_active, version, effective_from, ...)
product_rates (id, product_id, min_taeg numeric(5,4), max_taeg, base_rate, effective_from, created_by)
product_rules (id, product_id, rule_key, rule_value jsonb, is_hard_rule bool, needs_legal_validation bool, ...)
documents (id, application_id, uploader_id, s3_key, type, status, virus_scan, metadata jsonb, ...)
kyc_verifications (id, customer_id, status, provider, provider_ref, documents jsonb, verified_at, expires_at, ...)

-- Credit
applications (id, customer_id, product_id, country_code, amount numeric, term_months, purpose, status enum, scoring_snapshot jsonb, decision_snapshot jsonb, exception_reason text, decided_by FK users, decided_at, ...)
scorings (id, application_id, score int, grade, debt_ratio numeric, recommendation enum, details jsonb, calculated_by SYSTEM, ...)
decisions (id, application_id, recommended enum, decided enum, reason_i18n, exception bool, decided_by, audit_hash, ...)
repayments (id, application_id, schedule jsonb, next_due_date, status, ...)
payments (id, repayment_id, amount, status enum PENDING|CONFIRMED|FAILED, psp_ref, idempotency_key unique, ...)

-- System
notifications (id, user_id, channel enum EMAIL|SMS|WHATSAPP|PUSH, template_key, locale, payload jsonb, status, sent_at, ...)
audit_logs (id, actor_id, action, entity, entity_id, before jsonb, after jsonb, reason, hash, prev_hash, created_at)

-- Config
admins (id FK users, permissions jsonb, ...)
feature_flags (key, enabled, rollout jsonb, ...)
```

### 4.3 Exemple règle configurable (pas en dur!)
```json
// product_rules pour BE / PERSONAL
{ "rule_key": "max_debt_ratio", "rule_value": { "value": 0.33, "unit": "ratio" }, "is_hard_rule": false }
{ "rule_key": "min_age", "rule_value": { "years": 18 }, "is_hard_rule": true, "needs_legal_validation": true }
{ "rule_key": "max_amount_BE", "rule_value": { "amount": 50000, "currency": "EUR" } }
```
Moteur lit depuis DB/cache, pas depuis `if (country==='BE') ...`.

### 4.4 Rétention & RGPD
- Données KYC chiffrées, rétention 10 ans (configurable par pays, validation juridique).
- Droit à l'oubli: anonymisation `users` (email hashé) + conservation audit légal.

---

## 5. Flux Métiers Détaillés

### 5.1 Simulation (sans engagement)
User (anon ou auth) →Front: montant/durée/produit/BE → `POST /simulations` → Moteur calcule TAEG indicatif depuis `product_rates` BE + frais → retour `monthly`, `total`, `taeg`, `amortization_preview[12]` + `disclaimer: "Simulation indicative..."` → PDF optionnel marqué simulation. Aucun stockage PII obligatoire, log anonyme.

### 5.2 Demande → Décision (happy path)
1. CUSTOMER s'inscrit (KYC NOT_STARTED) → upload pièces (S3 présigné → virus scan queue)
2. Crée application DRAFT → soumet → SUBMITTED
3. Queue: KYC provider (Onfido/Veriff) → KYC_PENDING → si échec → MORE_INFO_REQUESTED
4. Scoring: calcule debt_ratio, grade A-E, recommandation (`RECOMMENDED_APPROVE` etc.) → SCORING → PENDING_REVIEW
5. ADMIN voit dossier + scoring + documents + audit → prend décision (approve/reject/conditional) + motif obligatoire si dérogation → DECIDED_*
6. Notification multi-canal (template i18n) → si APPROVED → génération contrat (S3) → DISBURSED via Payments (PSP)
7. Repayment: génération échéancier français → prélèvements mensuels → suivi impayés.

### 5.3 Dérogation exceptionnelle
ADMIN veut approuver hors plafond → coche “Décision exceptionnelle” → doit saisir motif détaillé → si montant < seuil SUPER_ADMIN → ADMIN peut; si > seuil → passe en `PENDING_SUPER_REVIEW` → SUPER_ADMIN valide → audit avec `exception=true` + hash.

### 5.4 Investissements (séparé)
CUSTOMER → catalogue produits investissement BE (risque 1-7) → quiz adéquation (MiFID-like, configurable) → souscription → PSP → portefeuille. Toujours disclaimer perte en capital.

---

## 6. Dépendances Externes

| Domaine | Provider recommandé (EU) | Rôle | Fallback |
|---|---|---|---|
| **KYC / ID Vérif** | Onfido / Veriff / IDnow (EU) | Vérif identité, liveness | Manuel ADMIN |
| **AML / PEP / Sanctions** | ComplyAdvantage / Dow Jones | Screening | Queue manuelle |
| **PSP** | Mollie (BE/NL) + Stripe | Paiements, prélèvements SEPA | Virement manuel |
| **Email** | AWS SES / Sendgrid (EU region) | Transactionnel | Queue retry |
| **SMS** | Twilio / Vonage | OTP, notifs | Email fallback |
| **WhatsApp** | Meta Cloud API | Notifs, support | SMS |
| **Push** | Web Push (VAPID) | PWA notifs | Email |
| **Stockage** | S3 / R2 / MinIO | Documents | — |
| **Antivirus** | ClamAV (self-host) | Scan docs | Quarantaine |
| **Géocodage/Adresse** | BeSt Address (BE) | Vérif adresse | Manuel |
| **Monitoring** | Grafana/Loki/Prometheus + Sentry | Obs | — |

Toutes intégrations derrière interface `ports` + feature flag `integration.enabled` + circuit breaker.

---

## 7. Risques Techniques

| Risque | Impact | Mitigation |
|---|---|---|
| **Dérive règles en dur** | Dette, non-conformité | Lint rule interdisant littéraux BE/TAEG en code + revue PR + tests config |
| **Décision auto déguisée** | Réglementaire majeur | State machine testée, pas de endpoint `autoApprove`; double validation humaine |
| **Fuite PII / RGPD** | Amende | Chiffrement, minimisation, DPA, audit, anonymisation, DPIA |
| **Montée charge simulation** | Perf | Cache Redis 60s par params, rate-limit, calcul pur sans DB |
| **Incohérence devise/taux** | Financier | `numeric` strict, pas de float, source unique `product_rates`, tests arrondis |
| **PWA offline & stale data** | UX | Workbox stale-while-revalidate uniquement pour assets; API toujours network-first |
| **Vendor lock KYC/PSP** | Disponibilité | Abstraction provider, mode dégradé manuel, queues idempotentes |
| **Audit altérable** | Légal | Append-only + hash chaîné + export WORM S3 + vérif périodique |
| **i18n incomplet** | Réputation | CI check `messages` 100% clés, fallback EN, pseudo-loc test |

---

## 8. Points Réglementaires Nécessitant Validation Humaine/Juridique

> **Avertissement:** KREDIT n'est pas un établissement de crédit. Ne pas présenter comme banque. Toute offre ferme requiert agrément BNB/FSMA. Les points ci-dessous sont **configurables** et marqués `needs_legal_validation=true` jusqu'à avis avocat.

1.  **Agrément & intermédiation:** Statut exact (courtier vs prêteur) — BE nécessite inscription FSMA. Qui porte le risque? À clarifier.
2.  **Crédit hypothécaire vs consommation:** Régimes distincts (Code de droit économique Livre VII). Plafonds, TAEG, droit de rétractation 14j, tableau amortissement — à valider par juriste BE.
3.  **Taux & usure:** TAEG max légal BE par catégorie — ne pas coder en dur; attendre circulaire FSMA. Config `max_taeg`.
4.  **Scoring & non-discrimination:** Interdiction critères sensibles (RGPD art.22, loi anti-discrimination). Scoring = aide, pas décision automatisée opposable sans intervention humaine (RGPD art.22).
5.  **KYC/AML:** Obligations LBC/FT (loi 18/09/2017). Niveaux vérif, conservation 10 ans, déclaration CTIF — valider avec compliance officer.
6.  **Droit de rétractation & information précontractuelle:** Fiche SECCI, offre préalable — templates à valider.
7.  **Investissements:** Si titres/fonds, prospectus + MiFID II + PRIIPs. Séparer clairement crédit/invest. Risque de requalification.
8.  **Langues BE:** Obligation d'information dans langue du consommateur (FR/NL/DE selon région). À mapper.
9.  **Archivage & preuve:** Valeur probante signature électronique (eIDAS) — QES ou AES?
10. **Assurance emprunteur:** Non obligatoire mais proposée? Vérifier démarchage.
11. **Frais & coûts annexes:** Transparence totale, pas de frais cachés.
12. **Données BCE / Centrale des crédits (BNB):** Consultation obligatoire? À valider.

**Implémentation:** Chaque `product_rules` avec `needs_legal_validation` affiche bannière admin “⚠️ Validation juridique requise”. Aucune mise en prod d'une règle bloquante sans `validated_by_legal_at`.

---

## 9. Plan de Développement par Étapes

### Phase 0 — Fondations (S1, 2 semaines)
- Monorepo, CI/CD, Docker, lint, tests, PostgreSQL + Redis + MinIO local.
- Auth + RBAC (3 rôles), i18n 4 langues, design system Dewi, PWA shell, audit skeleton.
- **Livrable:** Landing + login + dashboard vide multilingue, PWA installable.

### Phase 1 — Cœur Crédit (S3-5)
- Countries (BE), Products, Rates, Rules (configurable), Simulation (moteur pur).
- Applications (state machine), Documents (S3 présigné + scan), Scoring (règles BE).
- **Livrable:** Simulation indicative + parcours complet jusqu'à PENDING_REVIEW (sans PSP).

### Phase 2 — Décision & Conformité (S6-7)
- Decision Engine (reco vs décision humaine), dérogation avec audit, KYC stub + provider interface.
- Notifications (Email + Push), audit hash-chained, admin UI.
- **Livrable:** ADMIN décide, audit immuable, notifs i18n.

### Phase 3 — Paiements & Remboursement (S8-9)
- Repayment (amortissement français), Payments (Mollie/Stripe SEPA), webhooks idempotents.
- Dashboard client échéancier, admin réconciliation.
- **Livrable:** Déblocage + échéancier + suivi.

### Phase 4 — Investissements & Ops (S10-12)
- Investments (catalogue, adéquation, souscription), SUPER_ADMIN (config, logs, feature flags).
- Observabilité (Sentry, Grafana), sauvegardes, charge, RGPD (anonymisation, export).
- **Livrable:** Plateforme complète BE en pré-prod.

### Phase 5 — Durcissement & EU Scale (S13+)
- Tests charge, pentest, DPIA, validation juridique externe, docs FSMA.
- Extensibilité pays 2 (NL/LU) — juste config, pas de code.
- **Livrable:** Go-live BE + runbook.

**Critères “production-ready” par phase:** 80% coverage domaine, e2e Playwright (FR/NL), migrations versionnées, audit vert, perf Lighthouse >90, PWA score 100.

---

## Annexe — Inspiration Dewi appliquée (charte)

- **Palette:** Noir `#0F1115` (header/footer), Rouge `#FF4A17` (CTA, accents), Gris `#F6F7F9` (fonds), Slate `#6B7280`, Succès `#059669`.
- **Typo:** Inter / Raleway bold pour titres (700), Open Sans pour corps, chiffres tabulaires pour montants.
- **Composants Dewi traduits:** hero overlay + CTA double, stats band, cards image-top, tabs underline rouge, icon-box 6-col, testimonial carousel, portfolio → compare table.
- **Motion:** AOS douce (fade-up 200ms), pas de parallax lourd.
- **Accessibilité:** Contraste AA, focus rouge, tap 44px.

*Document vivant — toute règle métier ajoutée doit mettre à jour §4-5 et créer migration config, jamais code en dur.*

