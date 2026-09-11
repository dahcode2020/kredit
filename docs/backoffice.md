# KREDIT — Back-office ADMIN / SUPER_ADMIN (v1)

> 2 rôles uniquement. `ADMIN` = opérationnel (clients, dossiers, décision). `SUPER_ADMIN` = `ADMIN` + config sensible (admins, produits, règles, taux, pays, langues, params, intégrations, logs). MFA TOTP obligatoire pour tout compte admin (bloque l'accès tant que `mfaVerified≠true`).

## Principes

* **RBAC:** `@Roles('ADMIN','SUPER_ADMIN')` + `@RequireMFA()` guard. `SUPER_ADMIN` peut tout, `ADMIN` 403 sur `/admin/settings` sensible.
* **Shell:** `AdminShell` — sidebar 280 (dark ink), header 56 (breadcrumbs + locale + MFA badge + avatar ADMIN), main 1280, bottom nav mobile. `SUPER_ADMIN` bande rouge `Mode sensible`.
* **Audit:** chaque `approve / approve_exception / reject / request_doc / review` → `audit_logs` (hash) + `credit_application_status_history` + `application.decided` event. `APPROVED_WITH_EXCEPTION` impose `exceptionReason 20-2000` + affiche `règles non respectées` (ex: `max_debt_ratio 38%>33%`).
* **MFA:** `POST /admin/mfa/setup` (QR) → `POST /admin/mfa/verify` (6 digits) → `mfaVerifiedAt`. Middleware `AdminMFAGuard` redirige vers `/admin/mfa` si non vérifié.

---

## Routes (Next.js `app/[locale]/admin/*`)

```
/admin/dashboard              # ADMIN+ (métriques 10, alertes)
/admin/customers              # ADMIN+ (search, KYC, risque)
/admin/customers/[id]         # ADMIN+ (360° client, dossiers)
/admin/credit-applications    # ADMIN+ (file UNDER_ADMIN_REVIEW, filtres)
/admin/credit-applications/[id] # ADMIN+ (écran décision complet, voir §2)
/admin/loans                  # ADMIN+ (DISBURSED → remboursements)
/admin/investments            # ADMIN+ (portefeuille global)
/admin/payments               # ADMIN+ (PSP, mandats, réconciliation)
/admin/documents              # ADMIN+ (queue ClamAV, vérif)
/admin/notifications          # ADMIN+ (templates i18n, envois)
/admin/audit                  # ADMIN+ (hash-chaîné, export WORM)
/admin/settings               # ADMIN (lecture) / SUPER_ADMIN (écriture: 9 onglets)
/admin/mfa                    # SETUP MFA (bloquant)
```

`ADMIN` voit `settings` en lecture seule (bannière `Lecture seule — SUPER_ADMIN requis pour modifier`). `SUPER_ADMIN` voit onglets: `Administrateurs | Produits | Règles | Taux | Pays | Langues | Params | Intégrations | Logs`.

---

## 1. `/admin/dashboard` — 10 métriques + alertes

**Cards:** `Clients (8 400)`, `Demandes (12 700)`, `En attente (42)` (`SUBMITTED+KYC_PENDING+DOCUMENTS_PENDING`), `À examiner (12)` (`UNDER_ADMIN_REVIEW`), `Approuvées (7 100)`, `Refusées (3 200)`, `Crédits actifs (6 800)`, `Remboursements ce mois (2.1M€)`, `Investissements (1 200)`, `Alertes (3)` (KYC expiré, PSP échoué, docs manquants).

* Composants: `StatGrid`, `AlertBanner` (amber/red), `QueueTable` (12 à examiner, tri risque), `Chart` (demandes 7j).
* Actions: `Voir file` → `/credit-applications?status=UNDER_ADMIN_REVIEW`.
* Loading: skeleton 10 cards, empty jamais, error retry.

## 2. `/admin/credit-applications/[id]` — Écran décision (cœur)

**Sections (2 col desktop):**

* **Header:** `KRD-0842 • 15 000€ 48m • UNDER_ADMIN_REVIEW` + `ADMIN` avatar + `MFA ✓`.
* **Identité:** `Alex Martin, 32a, BE, CDI, 3 200€/m` + `NISS hash`.
* **KYC:** `itsme® VERIFIED 08/09 + PEP clean` + `liveness 0.98`.
* **Documents:** table `ID VERIFIED, INCOME_3M VERIFIED, PROOF_ADDRESS PENDING` + `Voir (signed URL 15m)` + `VirusScan OK`.
* **Situation financière:** `Revenus 3 200, Charges 900, Existants 250, Capacité 1 711, Dette 38.4%` (bar 33% rouge).
* **Simulation:** `monthly 338.62, TAEG 4.21%, total 16 414€` + `RateRule rate_BE_PERSONAL_10001_25000` + `schedule 12`.
* **Règles respectées** (vert): `min_age 32≥18`, `max_amount 15k≤50k`, `min_income 3 200≥900`.
* **Règles non respectées** (amber/red): `max_debt_ratio 38.4%>33% (soft)`, `max_age ok` — **affichées clairement si `APPROVED_WITH_EXCEPTION`**.
* **Score:** `62 C — Moyen, breakdown debt15 + stability20 + emploi12 + purpose8 + term7`.
* **Recommandation auto:** `REVIEW_RECOMMENDATION` (chip amber) + `explanation`.
* **Historique:** `credit_application_status_history` (timeline 17 étapes, actor, reason, metadata).
* **Notes internes:** textarea (privé, audit).
* **Décisions précédentes:** si redo.

**Actions (guardées `ApplicationWorkflowService`):**

* `Demander document` → `UNDER_ADMIN_REVIEW → MORE_INFORMATION_REQUIRED` (reason + `missingDocs` → notif CUSTOMER).
* `Mettre en revue` → reste `UNDER_ADMIN_REVIEW` (note).
* `Approuver` → `→ APPROVED` (si no hard fail, no exception).
* `Approuver avec exception` → modal `exceptionReason 20-2000` + `checkbox J'ai vérifié les règles non respectées` + affiche `règles concernées` + `valeurs (38.4% vs 33%)` → `→ APPROVED_WITH_EXCEPTION` (si >50k → `SUPER_ADMIN` requis, sinon 403). Enregistre `admin, date/heure, règles, valeurs, motif, décision` dans `history.metadata` + `audit`.
* `Refuser` → `→ REJECTED` (reason obligatoire).

* Validation: `exceptionReason` 20-2000, sinon 422; `role` check; `BYPASS_DETECTED` si history manque KYC.
* États: loading skeleton, error `TRANSITION_NOT_ALLOWED` toast, success `Décision enregistrée — audit a3f9…`.

## 3. Autres pages (résumé)

* **`/customers`:** table `8 400` + search `email/NISS` + filtre `KYC, risque, country` + pagination 20. Empty `Aucun client`.
* **`/customers/[id]`:** 360° `profil, KYC, risk, dossiers (3), paiements, docs, audit`. Actions `Bloquer`, `Relancer KYC`.
* **`/credit-applications`:** file 12 `UNDER_ADMIN_REVIEW` + filtres `status, product, country, amount, score` + tri `risk desc`. Chip `REVIEW`.
* **`/loans`:** `DISBURSED` 6 800 + `nextDue, retard, taux`.
* **`/investments`:** portefeuille global 1 200, risk, perf.
* **`/payments`:** `pspRef, status PENDING/CONFIRMED/FAILED, réconciliation` + `Mandats SEPA`.
* **`/documents`:** queue `PENDING/VERIFIED/REJECTED (virus)`, `Voir`, `Re-vérifier`.
* **`/notifications`:** `channel Email/SMS/WhatsApp/Push`, `templateKey`, `locale`, `status`, `Prefs`.
* **`/audit`:** `audit_logs` hash-chaîné, `prev_hash`, `actor, action, entity, before/after, reason, requestId, ip`, export WORM, vérif `hash` bouton.
* **`/settings` (SUPER_ADMIN):** 9 onglets:
  - *Administrateurs* `CRUD` (email, role, MFA reset)
  - *Produits* `CRUD versionné` (min/max, type, isActive, effectiveFrom)
  - *Règles* `CRUD` (key, value JSON, isHard, needsLegalValidation, country/product)
  - *Taux* `CRUD RateRule` (bande amount×term, baseRate, fees, dates)
  - *Pays* `BE (+FR/NL/LU)` (currency, locales, isActive, config JSON)
  - *Langues* `FR/EN/NL/DE` (fallback, isActive)
  - *Params* `featureFlags, exceptionThreshold 50000, retention 10y`
  - *Intégrations* `itsme, Onfido, Mollie, SES, Twilio, WhatsApp` (on/off, keys masquées, test)
  - *Logs* `audit + application history` (filtre, export)

*Chaque écriture `SUPER_ADMIN` → `audit` + `history` + `event` + bannière `Mode sensible`.*

---

## Sécurité MFA

* `ADMIN` sans `mfaVerified` → redirect `/admin/mfa` (QR + 6 digits, 30s). `mfaSecret` chiffré AES-256.
* `AdminMFAGuard` + `RolesGuard` sur toutes `/admin/*`.
* `SUPER_ADMIN` actions sensibles demandent re-MFA (OTP 6).

---

## Responsive

* Desktop: sidebar 280 + main 12 cols. Mobile: bottom nav 5 (Dashboard, Dossiers, Clients, Audit, Réglages) + drawer.
* Tables → cards mobile, sticky header, `overflow-auto`.

---

## API (exemples)

* `GET /admin/customers?search=alex&kyc=VERIFIED`
* `GET /admin/credit-applications?status=UNDER_ADMIN_REVIEW`
* `POST /admin/credit-applications/:id/decision` `{toStatus:"APPROVED_WITH_EXCEPTION", exceptionReason:"Client 10 ans...", reason:"..."}`
* `POST /admin/credit-applications/:id/request-docs` `{missing:["BANK_STATEMENTS_3M"], reason:"Relevés manquants"}`
* `PUT /super/products/:id` `PUT /super/rules/:id` `POST /super/countries` (SUPER_ADMIN)

Tous `x-idempotency-key`, `422` si `MISSING_EXCEPTION_REASON`, `403` si `REQUIRES_SUPER_ADMIN`.

---

## Arborescence Next.js

```
app/[locale]/admin/
├── layout.tsx (AdminShell + MFA guard)
├── dashboard/page.tsx
├── customers/page.tsx
├── customers/[id]/page.tsx
├── credit-applications/page.tsx
├── credit-applications/[id]/page.tsx
├── loans/page.tsx
├── investments/page.tsx
├── payments/page.tsx
├── documents/page.tsx
├── notifications/page.tsx
├── audit/page.tsx
└── settings/page.tsx (9 onglets SUPER_ADMIN)
components/admin/AdminShell.tsx
lib/mockAdmin.ts
```

