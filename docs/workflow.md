# KREDIT — Workflow Complet Demande de Crédit (17 étapes → 16 statuts)

> **Principe inviolable:** Aucune transition ne contourne les contrôles. L'automatique recommande, l'humain décide. `APPROVED_WITH_EXCEPTION` exige `exceptionReason`. Chaque transition → `credit_application_status_history`, chaque action sensible → `audit_logs` hash-chaîné.

---

## 1. Parcours client (17 étapes) → Statuts

| # | Étape métier | Acteur | Données / Contrôles | Statut cible |
|---|--------------|--------|---------------------|--------------|
| 1 | **Simulation** | CUSTOMER (anon/auth) | 8 champs → `CreditEngine` (simulation/eligibility/score/reco). Pas de persistance obligatoire. `simulationOnly:true` | — |
| 2 | **Création compte** | CUSTOMER | `email, password, locale, country BE, RGPD consent v3` → `users` + `customers` | `DRAFT` (créé auto) |
| 3 | **Vérification email/tél** | SYSTEM → CUSTOMER | Email `token 24h` + SMS/WhatsApp OTP. `verified_at`. Bloque suite tant que non vérifié | `DRAFT` |
| 4 | **Infos personnelles** | CUSTOMER | `firstName, lastName, birthDate, nationality, address BE (BeSt), NISS hash` | `DRAFT` |
| 5 | **Situation pro** | CUSTOMER | `employmentStatus, employer, since` | `DRAFT` |
| 6 | **Situation financière** | CUSTOMER | `monthlyIncome, monthlyCharges, incomeType, existingCreditsMonthly, bank IBAN` + `debtRatio` calculé | `DRAFT` |
| 7 | **KYC** | SYSTEM (provider itsme®/Onfido) | `liveness, doc check, PEP/sanctions`. `KYC_PENDING` | `KYC_PENDING` |
| 8 | **Documents** | CUSTOMER | Upload S3 présigné `ID, INCOME_3M, PROOF_ADDRESS (+ conditionnels)`. Scan ClamAV → `DOCUMENTS_PENDING` | `DOCUMENTS_PENDING` |
| 9 | **Résumé** | CUSTOMER | Lecture `simulationSnapshot + eligibility` + `RGPD recap` | `DRAFT` (avant submit) |
|10 | **Acceptation conditions** | CUSTOMER | `SECCI, RGPD, eIDAS` cases cochées + `consentVersion` | `DRAFT` |
|11 | **Soumission** | CUSTOMER | `POST /applications/:id/submit` → vérif `allRequiredFields + verified + consent + docs >= minimal` | `SUBMITTED` |
|12 | **Analyse automatique** | SYSTEM (queue) | `KYC vérifié? docs vérifiés? scoring + eligibility + warnings` → `UNDER_AUTOMATED_REVIEW` → `recommendation` | `UNDER_AUTOMATED_REVIEW` → `UNDER_ADMIN_REVIEW` |
|13 | **Analyse administrative** | ADMIN | Lit `scoring, debt, docs, audit`. Peut demander `MORE_INFORMATION_REQUIRED` | `UNDER_ADMIN_REVIEW` |
|14 | **Décision finale** | ADMIN (SUPER_ADMIN si exception > seuil) | `APPROVED / APPROVED_WITH_EXCEPTION (+reason) / REJECTED` + `audit` | `APPROVED* / REJECTED` |
|15 | **Contrat** | SYSTEM → CUSTOMER | Génère PDF `CONTRACT_PENDING` (QES/AES), envoie Email/SMS. Customer signe | `CONTRACT_PENDING` → `CONTRACT_SIGNED` |
|16 | **Décaissement** | SYSTEM (PSP Mollie SEPA) | `mandate + psp_ref` → `DISBURSEMENT_PENDING` → `DISBURSED` (webhook) | `DISBURSED` |
|17 | **Remboursement** | SYSTEM (cron) + CUSTOMER | Échéancier `schedules`, prélèvements, `CLOSED` si soldé | `CLOSED` |

**Règle:** Étapes 2-10 = `DRAFT`. Impossible de `SUBMIT` si étape 3 ou 7 ou 8 manquante.

---

## 2. Statuts (16)

```ts
export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  KYC_PENDING = 'KYC_PENDING',
  DOCUMENTS_PENDING = 'DOCUMENTS_PENDING',
  UNDER_AUTOMATED_REVIEW = 'UNDER_AUTOMATED_REVIEW',
  UNDER_ADMIN_REVIEW = 'UNDER_ADMIN_REVIEW',
  MORE_INFORMATION_REQUIRED = 'MORE_INFORMATION_REQUIRED',
  APPROVED = 'APPROVED',
  APPROVED_WITH_EXCEPTION = 'APPROVED_WITH_EXCEPTION',
  REJECTED = 'REJECTED',
  CONTRACT_PENDING = 'CONTRACT_PENDING',
  CONTRACT_SIGNED = 'CONTRACT_SIGNED',
  DISBURSEMENT_PENDING = 'DISBURSEMENT_PENDING',
  DISBURSED = 'DISBURSED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}
```

Terminaux: `REJECTED, CLOSED, CANCELLED` (aucune sortie).

---

## 3. Transitions autorisées (matrice)

> `SYSTEM` = queue/worker, `CUSTOMER` = owner only, `ADMIN` = HUMAN, `SUPER_ADMIN` = si `amount > exceptionThreshold` (ex 50k)

| De → Vers | Par | Condition / Garde | Event |
|-----------|-----|-------------------|-------|
| `DRAFT → SUBMITTED` | CUSTOMER | `verifiedEmail && kyc!=REJECTED && allFields && consent && atLeast 1 doc` + `idempotency` | `application.submitted` |
| `DRAFT → CANCELLED` | CUSTOMER | Owner, avant SUBMIT | `application.cancelled` |
| `SUBMITTED → KYC_PENDING` | SYSTEM | Auto après SUBMIT (queue `kyc.start`) | `kyc.started` |
| `KYC_PENDING → DOCUMENTS_PENDING` | SYSTEM | `kyc.status==VERIFIED` | `kyc.verified` |
| `KYC_PENDING → REJECTED` | SYSTEM | `kyc hard fail` (fraude, <18, PEP bloquant) — seul REJECT auto autorisé | `kyc.rejected` |
| `KYC_PENDING → MORE_INFORMATION_REQUIRED` | SYSTEM/ADMIN | `kyc need more` | `more_info.requested` |
| `DOCUMENTS_PENDING → UNDER_AUTOMATED_REVIEW` | SYSTEM | `allRequiredDocs == VERIFIED` (ClamAV + OCR) | `automated_review.started` |
| `DOCUMENTS_PENDING → MORE_INFORMATION_REQUIRED` | SYSTEM/ADMIN | `docs missing/invalid` | `more_info.requested` |
| `MORE_INFORMATION_REQUIRED → DOCUMENTS_PENDING` | CUSTOMER | Upload nouveau doc | `documents.uploaded` |
| `MORE_INFORMATION_REQUIRED → KYC_PENDING` | CUSTOMER/SYSTEM | Si KYC expiré / redo | `kyc.started` |
| `MORE_INFORMATION_REQUIRED → CANCELLED` | CUSTOMER | Abandon | `application.cancelled` |
| `UNDER_AUTOMATED_REVIEW → UNDER_ADMIN_REVIEW` | SYSTEM | Toujours (reco `APPROVE/REVIEW/REJECT` stockée, jamais REJECT direct) | `admin_review.started` |
| `UNDER_ADMIN_REVIEW → APPROVED` | ADMIN | `no hard fail` + `no exception` | `application.approved` |
| `UNDER_ADMIN_REVIEW → APPROVED_WITH_EXCEPTION` | ADMIN (+SUPER_ADMIN si >seuil) | **`exceptionReason` obligatoire, 20-2000 chars, audit** | `application.approved_with_exception` |
| `UNDER_ADMIN_REVIEW → REJECTED` | ADMIN | Avec `reason` | `application.rejected` |
| `UNDER_ADMIN_REVIEW → MORE_INFORMATION_REQUIRED` | ADMIN | Avec `reason` | `more_info.requested` |
| `APPROVED → CONTRACT_PENDING` | SYSTEM | Génère contrat SECCI | `contract.created` |
| `APPROVED_WITH_EXCEPTION → CONTRACT_PENDING` | SYSTEM | Idem + flag `exception` dans contrat | `contract.created` |
| `CONTRACT_PENDING → CONTRACT_SIGNED` | CUSTOMER | Signature QES/AES + `audit` | `contract.signed` |
| `CONTRACT_PENDING → CANCELLED` | CUSTOMER | Refus / timeout 14j (droit rétractation) | `application.cancelled` |
| `CONTRACT_SIGNED → DISBURSEMENT_PENDING` | SYSTEM | Crée `mandate SEPA` | `disbursement.initiated` |
| `DISBURSEMENT_PENDING → DISBURSED` | SYSTEM | Webhook PSP `CONFIRMED` + `psp_ref` | `disbursement.completed` |
| `DISBURSED → CLOSED` | SYSTEM | Cron `all installments PAID` | `application.closed` |
| `* → REJECTED` | — | **INTERDIT** sauf lignes ci-dessus (pas de DRAFT→REJECTED direct) | — |
| `* → APPROVED` | — | **INTERDIT** sauf `UNDER_ADMIN_REVIEW` | — |

**Gardes globales:**

* `CANCELLED, REJECTED, CLOSED` n'ont **aucune** sortie.
* Impossible de sauter `KYC_PENDING` ou `DOCUMENTS_PENDING` — `UNDER_AUTOMATED_REVIEW` exige `kyc==VERIFIED && docs==VERIFIED`.
* `APPROVED_WITH_EXCEPTION` sans `exceptionReason` → `422 MISSING_EXCEPTION_REASON`.
* `amount > exceptionThreshold` (ex 50000) + `APPROVED_WITH_EXCEPTION` → `requires SUPER_ADMIN` (ADMIN seul → 403).
* `SUBMITTED → *` seul `SYSTEM` peut sortir (pas CUSTOMER).

Diagramme simplifié:

```
DRAFT → SUBMITTED → KYC_PENDING → DOCUMENTS_PENDING → UNDER_AUTOMATED_REVIEW → UNDER_ADMIN_REVIEW
          ↘CANCELLED   ↘REJECTED      ↘MORE_INFO ↔↘                    ↘ APPROVED(→CONTRACT→DISBURSED→CLOSED)
                                                                   ↘ APPROVED_WITH_EXCEPTION
                                                                   ↘ REJECTED
                                                                   ↘ MORE_INFO
```

---

## 4. Schéma persistance

### 4.1 `credit_applications` (extrait)

```sql
id UUID PK, customer_id FK users, product_id FK, country CHAR2, amount NUMERIC, term INT,
status ApplicationStatus NOT NULL DEFAULT 'DRAFT',
current_step INT DEFAULT 1, -- 1..17
simulation_snapshot JSONB, eligibility_snapshot JSONB, scoring_snapshot JSONB,
exception_reason TEXT, decided_by FK, decided_at TIMESTAMPTZ,
contract_ref TEXT, psp_ref TEXT,
created_at, updated_at
```

### 4.2 `credit_application_status_history` (append-only)

```sql
CREATE TABLE credit_application_status_history (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES credit_applications(id),
  from_status ApplicationStatus NOT NULL,
  to_status ApplicationStatus NOT NULL,
  actor_id UUID REFERENCES users(id), -- NULL si SYSTEM
  actor_role TEXT, -- CUSTOMER|SYSTEM|ADMIN|SUPER_ADMIN
  reason TEXT, -- obligatoire si EXCEPTION / REJECT / MORE_INFO
  metadata JSONB, -- {recommendation, debtRatio, score, psp_ref, ...}
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_hist_app ON credit_application_status_history(application_id, created_at);
-- RLS: INSERT only (pas UPDATE/DELETE) — trigger

INSERT INTO credit_application_status_history(application_id, from_status, to_status, actor_id, actor_role, reason, metadata)
VALUES ('...', 'UNDER_ADMIN_REVIEW','APPROVED_WITH_EXCEPTION', 'admin-42','ADMIN', 'Client historique 10 ans, garanties', '{"score":"C","debt":0.38}');
```

Chaque `UPDATE credit_applications.status` **doit** être dans même transaction que l'`INSERT history`.

### 4.3 `audit_logs` (sensible, WORM, hash-chaîné)

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID, actor_role TEXT, action TEXT NOT NULL, -- e.g. 'application.decide'
  entity TEXT NOT NULL, -- 'credit_application'
  entity_id UUID NOT NULL,
  before JSONB, after JSONB,
  reason TEXT,
  request_id TEXT, ip TEXT,
  hash TEXT NOT NULL, prev_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- hash = SHA256(prev_hash || payload)
```

Actions sensibles loguées: `application.create, submit, kyc.verify, document.upload, document.verify, automated_review.complete, admin.decide, admin.decide_exception, contract.create, contract.sign, disbursement.initiate, disbursement.complete, status.transition, cancel, reject`.

---

## 5. Événements métier (BullMQ + EventEmitter)

Chaque transition publie **un** event `application.{status_snake}` + `audit` :

| Transition | Event | Payload | Queue | Consommateur |
|------------|-------|---------|-------|--------------|
| `SUBMITTED` | `application.submitted` | `{applicationId, customerId, country, product, amount}` | `kyc` | `KycWorker` → `KYC_PENDING` |
| `KYC_PENDING→DOC` | `kyc.verified` | `{kycId, provider, verifiedAt}` | — | `DocumentsWorker` |
| `DOCUMENTS→AUTO` | `documents.verified` | `{applicationId, docs[]}` | `scoring` | `ScoringWorker` → `UNDER_AUTOMATED_REVIEW` |
| `AUTO→ADMIN` | `automated_review.completed` | `{recommendation, score, debt}` | `notifications` | `AdminNotifier` |
| `UNDER_ADMIN→APPROVED*` | `application.approved` / `application.approved_with_exception` | `{decidedBy, exceptionReason}` | `contract` | `ContractWorker` → `CONTRACT_PENDING` |
| `UNDER_ADMIN→REJECTED` | `application.rejected` | `{reason}` | `notifications` | `CustomerNotifier` |
| `MORE_INFO` | `more_info.requested` | `{reason, missingDocs}` | `notifications` | — |
| `CONTRACT_SIGNED` | `contract.signed` | `{contractRef, signedAt, ip}` | `disbursement` | `PaymentsWorker` |
| `DISBURSED` | `disbursement.completed` | `{pspRef, amount}` | `repayment` | `ScheduleWorker` |
| `CLOSED` | `application.closed` | `{closedAt, totalRepaid}` | — | — |
| `CANCELLED` | `application.cancelled` | `{actor, reason}` | — | — |

Tous events ont `correlationId = requestId`, `country`, `occurredAt`, `actor`. Idempotence par `applicationId + eventType + createdAt` unique.

**Synchrones vs async:**

* **Sync (HTTP 2s):** `DRAFT→SUBMITTED` (validation), `UNDER_ADMIN_REVIEW→APPROVED*` (ADMIN attend 201), `CONTRACT_PENDING→CONTRACT_SIGNED` (customer)
* **Async (queue):** `SUBMITTED→KYC_PENDING→DOCUMENTS_PENDING→UNDER_AUTOMATED_REVIEW→UNDER_ADMIN_REVIEW` (providers, scoring), `APPROVED→CONTRACT_PENDING→DISBURSEMENT_PENDING→DISBURSED` (PSP, PDF), `notifications` toujours async.

---

## 6. Règles de garde (extraits code)

* `canTransition(from, to, actorRole, context)` → table `ALLOWED[from].includes(to)` + `roleGuard[transition].includes(actorRole)` + `exceptionReasonRequired`.
* `enforceNoBypass(application)` → vérifie `history` contient `KYC_PENDING` et `DOCUMENTS_PENDING` avant `UNDER_AUTOMATED_REVIEW`.
* `requireExceptionReason(to, reason)` → `if to==APPROVED_WITH_EXCEPTION && !reason.trim() → throw 422`.
* `requireSuperAdmin(amount, to, actorRole)` → `if to==APPROVED_WITH_EXCEPTION && amount>threshold && actorRole!=SUPER_ADMIN → 403`.

---

## 7. Exemple de vie d'un dossier

```
2026-09-10T08:00 CUSTOMER create DRAFT (history DRAFT)
08:02 CUSTOMER SUBMITTED (audit application.submit, history DRAFT→SUBMITTED, event application.submitted)
08:02 SYSTEM → KYC_PENDING (history)
08:03 SYSTEM KYC verified → DOCUMENTS_PENDING (audit kyc.verify)
08:05 CUSTOMER upload ID → DOCUMENTS_PENDING (audit document.upload)
08:06 SYSTEM docs verified → UNDER_AUTOMATED_REVIEW (event automated_review.started)
08:07 SYSTEM scoring C, reco REVIEW → UNDER_ADMIN_REVIEW (history, audit automated_review.complete)
09:15 ADMIN decides APPROVED_WITH_EXCEPTION reason="Client 10 ans, garanties" → APPROVED_WITH_EXCEPTION (history + audit admin.decide_exception hash chaîné)
09:16 SYSTEM → CONTRACT_PENDING (event contract.created)
09:20 CUSTOMER signs → CONTRACT_SIGNED (audit contract.sign)
09:21 SYSTEM → DISBURSEMENT_PENDING → DISBURSED (psp webhook, audit)
2030-09-21 SYSTEM → CLOSED (audit)
```

Tout est rejouable via `SELECT * FROM credit_application_status_history WHERE application_id='...' ORDER BY created_at`.

---

## 8. API

* `POST /credit/applications` → crée `DRAFT`
* `PATCH /credit/applications/:id` → maj étapes 4-10 (reste DRAFT)
* `POST /credit/applications/:id/submit` → `DRAFT→SUBMITTED` (CUSTOMER)
* `POST /credit/applications/:id/transition` → `ADMIN` `{toStatus, reason, exceptionReason}` — seul endpoint pour `UNDER_ADMIN_REVIEW` sorties
* `POST /credit/applications/:id/cancel` → CUSTOMER
* `POST /credit/applications/:id/contract/sign` → CUSTOMER

Tous `x-idempotency-key`, `x-request-id`, `422` si transition interdite.

---

## 9. Tests d'invariants

* `DRAFT → UNDER_ADMIN_REVIEW` doit échouer `403 TRANSITION_NOT_ALLOWED`
* `UNDER_ADMIN_REVIEW → APPROVED_WITH_EXCEPTION` sans reason → `422 MISSING_EXCEPTION_REASON`
* `APPROVED_WITH_EXCEPTION` + amount 60000 + role ADMIN (pas SUPER) → `403 REQUIRES_SUPER_ADMIN`
* `REJECTED → *` impossible
* `history` count == nombre de transitions
* `audit` hash chaîné vérifiable `SHA256(prev+payload)==hash`

Voir `backend/src/credit/applications/__tests__/workflow.spec.ts`
