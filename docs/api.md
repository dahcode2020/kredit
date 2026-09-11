# KREDIT — API REST Complète — OpenAPI 3.1 / Swagger

> Base URL `https://api.kredit.be/api/v1` (prod) / `http://localhost:4000/api/v1` (dev) — `Content-Type: application/json` — Versionnage `/v1` — `X-Request-Id` + `X-Idempotency-Key` — Swagger `GET /api/docs` — OpenAPI JSON `GET /api/docs-json`.

---

## 0. Conventions globales

| Aspect | Règle |
|--------|-------|
| **Prefix** | `/api/v1` obligatoire, jamais de breaking sans `/v2` |
| **Auth** | `Authorization: Bearer <JWT access 15m RS256>` + `Cookie: refreshToken=... HttpOnly SameSite=Strict 7j` |
| **Pagination** | `GET` listes → `?page=1&limit=20` → `{data:[], meta:{total, page, limit}, links:{next, prev}}` |
| **Filtrage** | `?status=PENDING&country=BE&type=BOND` — whitelist par endpoint |
| **Idempotence** | `POST` sensibles → `X-Idempotency-Key: uuid v4` requis → `409` si rejoué avec payload différent, `200` si même payload → réponse rejouée. Stock 24h Redis + DB permanente. |
| **Correlation** | `X-Request-Id: req_9c1e` généré si absent, propagé logs/audit/queues |
| **Erreurs** | Enveloppe uniforme ` {statusCode, message, code: 'CREDIT_AMOUNT_EXCEEDS_CEILING', details:[{field, issue}], requestId, timestamp}` |
| **Validation** | `class-validator` + `whitelist:true, forbidNonWhitelisted:true` → `422` si champ inconnu |
| **Rate limit** | `100/min` IP global, `5/min` auth, `3/min` OTP — headers `X-RateLimit-*` |
| **Audit** | Tout `POST/PUT/DELETE` → `audit_logs` hash-chaîné `hash=sha256(prev+payload)` |
| **RBAC** | `CUSTOMER` / `ADMIN` / `SUPER_ADMIN` via `@Roles()` + `@RequireMFA()` pour admin |
| **Langue** | `Accept-Language: fr-BE` + `users.locale` → réponses i18n `errors.*` |
| **Devise** | `EUR` uniquement, montants `number` + `numeric(15,2)` en DB |

**Codes HTTP** : `200` OK, `201` Created, `204` No Content, `400` Bad Request, `401` Unauthorized, `403` Forbidden, `404` Not Found, `409` Conflict (idempotence), `422` Validation, `429` Rate Limited.

**Swagger** : `GET /api/docs` (Swagger UI) + `GET /api/docs-json` (OpenAPI 3.1). Bearer Auth configuré. `helmet` + `CORS kredit.be`.

---

## 1. Authentification

### POST /auth/register — Créer compte CUSTOMER
- **Auth**: non
- **Body**: `{email: string (email), password: string (8+ maj+min+chiffre), locale?: 'fr'|'en'|'nl'|'de', acceptGdpr: boolean}` → `400` si `acceptGdpr=false`
- **Validation**: `email` unique, `password` `8-64`, `locale` in `fr,en,nl,de`
- **Response 201**: `{id, email, locale, emailVerified: false}` + `Set-Cookie: refreshToken=...`
- **Erreurs**: `409 EMAIL_ALREADY_EXISTS`
- **Idempotence**: oui (`X-Idempotency-Key`)
- **Audit**: `auth.register` + `audit_logs`
```json
// Request
{"email":"alex@kredit.be","password":"Customer123!","locale":"fr","acceptGdpr":true}
// Response 201
{"id":"usr_9c1e","email":"alex@kredit.be","locale":"fr"}
```

### POST /auth/login
- **Auth**: non
- **Body**: `{email, password, totp?: string (si MFA)}`
- **Validation**: `email`, `password`, `totp` 6 chiffres si `mfa_enabled`
- **Response 200**: `{accessToken: 'eyJ...', user:{id, role, locale}}` + `Set-Cookie: refreshToken`
- **Erreurs**: `401 INVALID_CREDENTIALS`, `401 MFA_REQUIRED`, `423 LOCKED` (5 échecs → 15m)
- **Rate**: `5/min`
- **Audit**: `auth.login.succeeded|failed`

### POST /auth/logout
- **Auth**: oui (`Bearer`)
- **Response 204**: `Set-Cookie: refreshToken=; Max-Age=0` + denylist `jti` Redis
- **Audit**: `auth.logout`

### POST /auth/refresh
- **Auth**: `Cookie: refreshToken` (pas de Bearer)
- **Response 200**: `{accessToken}` + rotation `Set-Cookie: refreshToken=new` (ancien révoqué, double usage → révocation famille)
- **Erreurs**: `401 REFRESH_INVALID`
- **Audit**: `auth.refresh`

### POST /auth/verify-email
- **Auth**: oui
- **Body**: `{code: string (6 chiffres)}` — OTP envoyé à l'inscription via `NotificationsService` `OTP_REQUESTED` Email
- **Validation**: `code` 6 chiffres, TTL 5m, 3 essais max
- **Response 200**: `{verified: true, emailVerifiedAt}`
- **Erreurs**: `400 OTP_EXPIRED`, `400 OTP_INVALID`
- **Idempotence**: non
- **Audit**: `auth.verify_email`

### POST /auth/verify-phone
- **Auth**: oui
- **Body**: `{phone: string (E.164 +32...), code: string}`
- **Validation**: `phone` `libphonenumber-js` BE, `code` 6 chiffres
- **Response 200**: `{verified: true, phoneVerifiedAt}`
- **Rate**: `3/min`
- **Audit**: `auth.verify_phone`

### POST /auth/2fa
- **Auth**: oui
- **Body**: `{action: 'enable'|'verify'|'disable', code?: string}`
- **`enable`**: → `{secret: 'otpauth://...', qr: 'data:image/png...'}`
- **`verify`**: `{code}` → `{enabled: true, mfa_verified_at}`
- **Validation**: `code` 6 chiffres TOTP
- **Authorization**: `CUSTOMER` self, `ADMIN` self (obligatoire)
- **Response 200**: `{enabled, mfa_verified_at}`
- **Audit**: `auth.2fa.*`

---

## 2. Customer

### GET /customer/profile — Mon profil
- **Auth**: oui
- **Roles**: `CUSTOMER`
- **Response 200**: `{id, email, phone, phoneVerifiedAt, locale, country:'BE', kycStatus, createdAt}`
- **Erreurs**: `401`
- **Audit**: non (lecture)

### PUT /customer/profile
- **Auth**: oui, `CUSTOMER` self
- **Body**: `{firstName?, lastName?, locale? 'fr'|'en'|'nl'|'de', address?: {street, number, box, postal, city}}` — whitelist
- **Validation**: `locale` enum, `postal` BE `1000-9992`, `city` non vide
- **Response 200**: `{id, ...updated}`
- **Idempotence**: oui
- **Audit**: `customer.update` + hash

### GET /customer/security — Sécurité
- **Auth**: oui, `CUSTOMER`
- **Response 200**: `{mfaEnabled, mfaVerifiedAt, lastLoginAt, sessions: [{ip, device, at}], phoneVerified, emailVerified}`
- **Erreurs**: `401`

### GET /customer/notifications — Préférences
- **Auth**: oui, `CUSTOMER`
- **Response 200**: `{locale, emailEnabled, smsEnabled, whatsappEnabled, pushEnabled, preferences: {PAYMENT_DUE:{sms:true}}, consentWhatsappAt}`
- **PUT** non listé mais existe via `PUT /customer/notifications` (préférences)

---

## 3. Credit

### POST /credit/simulations — Simuler (sans auth, indicatif)
- **Auth**: non (cache 60s)
- **Body**: `{amount: number (1000-500000), termMonths: int (12-360), monthlyIncome: number, monthlyCharges: number, incomeType: enum, employmentStatus: enum, loanPurpose: enum, existingCreditsMonthly?: number, country?: 'BE', productType?: 'PERSONAL'|'MORTGAGE'|'BUSINESS', birthDate?: 'YYYY-MM-DD'}`
- **Validation**: `amount` dans `[min_amount,max_amount]` produit, `term` dans `[min_term,max_term]`, `monthlyIncome >=900`, `birthDate` age 18-75
- **Response 201**: `{id:'sim_9c1e', simulation:{monthlyPayment:338.62, annualRate:0.0421, taeg:0.0421, totalInterest:1414, fees:{file:150}, totalCost:16414, schedule:[{month:1,payment:338.62,interest:...,principal:...,balance:...}], disclaimer:'Simulation ≠ offre', meta:{country:'BE', product:'PERSONAL', rateRuleId:'rate_BE_PERSONAL_10001_25000', generatedAt}} , eligibility:{isEligible, debtRatio:0.384, repaymentCapacity:1711}, score:{value:62, grade:'C'}, recommendation:'REVIEW_RECOMMENDATION'}`
- **Erreurs**: `422 CREDIT_AMOUNT_EXCEEDS_CEILING (max 50000 BE PERSONAL)`, `422 NO_RATE_RULE`
- **Cache**: `Cache-Control: public, max-age=60`
- **Audit**: non (anonyme), log anonyme

### GET /credit/simulations/:id
- **Auth**: non
- **Response 200**: même `simulation`
- **Erreurs**: `404 SIMULATION_NOT_FOUND`
- **Cache**: 60s

### POST /credit/applications — Créer dossier
- **Auth**: oui, `CUSTOMER`
- **Body**: `{simulationId: string, amount: number, termMonths: int, purpose?: string, productType: enum, country: 'BE'}` — doit matcher `simulation` snapshot
- **Validation**: `simulationId` existe, `amount/term` identiques, `country` BE
- **Response 201**: `{id:'KRD-2026-0842', status:'DRAFT', simulation, createdAt}` + `Location: /credit/applications/KRD-2026-0842`
- **Idempotence**: oui (`X-Idempotency-Key` UUID) → `201` ou `200` même `id` si rejoué
- **Erreurs**: `422 AMOUNT_MISMATCH`, `409 DRAFT_ALREADY_EXISTS`
- **Audit**: `application.created` + `audit_logs`

### GET /credit/applications — Mes dossiers
- **Auth**: oui, `CUSTOMER`
- **Query**: `?status=DRAFT|SUBMITTED|...&page=1&limit=20`
- **Response 200**: `{data:[{id, status, amount, term, product, score, debt, createdAt}], meta:{total, page, limit}}`
- **AuthZ**: CUSTOMER voit seulement ses dossiers

### GET /credit/applications/:id
- **Auth**: oui, `CUSTOMER` owner
- **Response 200**: `{id, status, amount, term, simulation, eligibility, score, recommendation, documents:[], schedule, history:[{from,to,actor,at,reason}]}`

### PUT /credit/applications/:id — Modifier DRAFT
- **Auth**: oui, `CUSTOMER` owner
- **Body**: `{amount?, termMonths?, purpose?}` — seulement si `status=DRAFT`
- **Validation**: mêmes règles simulation
- **Response 200**: `{id, ...updated}`
- **Idempotence**: oui
- **Erreurs**: `409 NOT_DRAFT`, `422 VALIDATION`
- **Audit**: `application.updated`

### POST /credit/applications/:id/documents — Upload pièce
- **Auth**: oui, `CUSTOMER` owner
- **Request**: `multipart/form-data` `file` OU `POST /documents/presign` → `PUT S3` présigné 15m
- **Body**: `{code: 'ID'|'INCOME_3M'|'PROOF_ADDRESS'|'BANK_STATEMENTS_3M', file: binary}`
- **Validation**: `code` whitelist, `mime` pdf/jpg/png, `size <=10MB`, `sha256`
- **Response 201**: `{documentId, code, status:'PENDING', scanStatus:'PENDING', s3Key}`
- **Erreurs**: `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_MEDIA`
- **Audit**: `document.uploaded` → queue `documents.virus-scan` ClamAV

### DELETE /credit/applications/:id/documents — Supprimer (query code)
- **Auth**: oui, `CUSTOMER` owner, seulement `PENDING`/`REJECTED`
- **Query**: `?code=ID`
- **Response 204**
- **Erreurs**: `409 ALREADY_VERIFIED`
- **Audit**: `document.deleted`

### GET /credit/applications/:id/status — Statut + compliance
- **Auth**: oui, `CUSTOMER` owner
- **Response 200**: `{status, kycStatus, compliance:{blocked, reasons}, nextActions:[]}`

### GET /credit/applications/:id/schedule — Échéancier
- **Auth**: oui, `CUSTOMER` owner ou `ADMIN`
- **Response 200**: `{schedule:[{month, payment, interest, principal, balance}], total, monthly, taeg}` — méthode française

---

## 4. Investments

### GET /investment-products — Catalogue
- **Auth**: non ou oui (filtre pays)
- **Query**: `?country=BE&type=BOND&risk_lte=3&status=ACTIVE&page=1&limit=20`
- **Response 200**: `{data:[{id, code:'BE_GREEN_BOND_2031', name_i18n, type, country_code, currency:'EUR', min_amount:5000, risk_level:3, capital_guaranteed:false, yield_display:{text:'2.10% (indicatif)', disclaimer:'Risque perte capital'}, status:'ACTIVE'}], meta}`
- **Cache**: 60s

### GET /investment-products/:id
- **Auth**: non
- **Response 200**: `{id, code, name_i18n, description_i18n, type, yield_method:'FIXED', yield_config:{fixed_rate:0.021}, risk_level, capital_guaranteed, guarantee_details, documents:[{code:'PROSPECTUS'}], yield_display}`

### POST /investments — Souscrire
- **Auth**: oui, `CUSTOMER`
- **Body**: `{productId: string, amount: number, idempotencyKey: string (uuid), riskConfirm?: boolean, docsAck: boolean}`
- **Validation**: `amount >= min_amount`, `<= max_amount`, `total_subscribed+amount <= max_total`, `docsAck=true`, `riskConfirm=true` si `risk_level > risk_tolerance`
- **Contrôles bloquants**: `KYC VERIFIED`, `suitability quiz`, `restrictions pays/type`, `plafonds`
- **Response 201**: `{position:{id, product_id, amount_subscribed, status:'ACTIVE'}, transaction:{id, type:'SUBSCRIBED', status:'SUCCEEDED'}, yield_display}`
- **Idempotence**: oui (`idempotencyKey`) → même position si rejoué
- **Erreurs**: `403 NOT_ELIGIBLE: RISK_EXCEEDS_TOLERANCE`, `422 BELOW_MIN`, `409 EXCEEDS_EMISSION_CAP`
- **Audit**: `investment.subscribed`

### GET /investments — Mon portefeuille
- **Auth**: oui, `CUSTOMER`
- **Response 200**: `{data:[{id, product:{code, name_i18n}, amount_subscribed, amount_current, status:'ACTIVE', subscribed_at}], meta}`

### GET /investments/:id — Détail position
- **Auth**: oui, owner
- **Response 200**: `{id, product, amount_subscribed, amount_current, transactions:[{type, amount, status, created_at}], yield_display, documents}`

---

## 5. Payments

### POST /payments — Créer tentative paiement
- **Auth**: oui, `CUSTOMER` (échéance) ou `ADMIN`
- **Body**: `{loanId: string, installmentIds?: string[], amount: number, currency?: 'EUR', type?: 'INSTALLMENT'|'EARLY_REPAYMENT'|'FEES', idempotencyKey: string}`
- **Validation**: `amount >0`, `loanId` appartient à `customerId` (ou ADMIN), `installmentIds` ⊆ `loan`
- **Response 201**: `{payment:{id:'pay_9c1e', status:'PROCESSING', provider:'mollie', provider_payment_id:'tr_xxxx'}, checkoutUrl:'https://mollie.mock/checkout/...'}` + `Location`
- **Idempotence**: oui (`idempotencyKey` UNIQUE) → même `payment` si rejoué
- **Erreurs**: `404 LOAN_NOT_FOUND`, `409 ALREADY_PROCESSING`
- **Audit**: `payment.created`

### GET /payments — Mes paiements
- **Auth**: oui, `CUSTOMER` (ses loans) ou `ADMIN` (tous, filtre `?loanId=`)
- **Response 200**: `{data:[{id, loan_id, amount, status:'SUCCEEDED'|'PROCESSING'|'FAILED', provider_payment_id, created_at}], meta}`

### GET /payments/:id
- **Auth**: oui, owner ou ADMIN
- **Response 200**: `{id, loan_id, amount, status, provider_payment_id, receipt_url, transactions:[{type, status, provider_transaction_id}], created_at}`

> **Jamais `SUCCEEDED` sur succès navigateur** : `GET` reste `PROCESSING` jusqu’à webhook `paid` vérifié ou `POST /admin/payments/:id/confirm` (admin).

---

## 6. Notifications

### GET /notifications — Mes notifications
- **Auth**: oui, `CUSTOMER` ou `ADMIN` (ses notifs)
- **Query**: `?unread=true&page=1&limit=20`
- **Response 200**: `{data:[{id, channel:'EMAIL'|'SMS'|'WHATSAPP'|'PUSH', title, body, payload, locale, read: boolean, created_at}], meta}`

### PUT /notifications/:id/read — Marquer lue
- **Auth**: oui, owner
- **Body**: `{read: boolean}`
- **Response 200**: `{id, read: true}`
- **Idempotence**: oui
- **Audit**: non (préférence)

---

## 7. Admin — `ADMIN` + `SUPER_ADMIN` (MFA requis)

Tous `Authorization: Bearer <ADMIN JWT>` + `X-MFA-Verified: true` (guard `RequireMFA`).

### GET /admin/dashboard — Métriques
- **Roles**: `ADMIN`, `SUPER_ADMIN`
- **Response 200**: `{clients:8400, demandes:12700, enAttente:42, aExaminer:12, approuvees:7100, refusees:3200, actifs:6800, remboursements:2100000, investissements:1200, alertes:3, alerts:[{type, message}]}`
- **Audit**: non

### GET /admin/customers — Liste clients
- **Roles**: `ADMIN+`
- **Query**: `?search=alex@&kyc=VERIFIED&risk=Faible&page=1&limit=20`
- **Response 200**: `{data:[{id, name, email, kyc:'VERIFIED', risk:'Faible', dossiers:3, country:'BE'}], meta}`

### GET /admin/customers/:id — Détail 360°
- **Roles**: `ADMIN+`
- **Response 200**: `{id, name, email, kyc:{status, verifiedAt, pep}, dossiers:[{id, product, amount, status}], payments:[], documents:[]}`

### GET /admin/credit-applications — File
- **Roles**: `ADMIN+`
- **Query**: `?status=UNDER_ADMIN_REVIEW&product=PERSONAL&country=BE&minAmount=10000&sort=risk&page=1`
- **Response 200**: `{data:[{id, customer, amount, term, product, country, status, score:62, grade:'C', debt:'38.4%', kyc:'VERIFIED', docs:'2/3', reco:'REVIEW'}], meta}`

### GET /admin/credit-applications/:id — Écran décision
- **Roles**: `ADMIN+`
- **Response 200**: `{id, status:'UNDER_ADMIN_REVIEW', customer:{name, age:32, niss:'***123'}, kyc:{itsme:'VERIFIED', pep:'clean'}, documents:[{code, status}], financial:{income:3200, charges:900, debtRatio:0.384}, simulation:{monthly:338.62, taeg:0.0421, total:16414, rateRule:'rate_BE_PERSONAL_10001_25000'}, score:{value:62, grade:'C', breakdown}, rules:{passed:[{key:'min_age', value:32, threshold:18}], failed:[{key:'max_debt_ratio', value:0.384, threshold:0.33, isHard:false}]}, recommendation:'REVIEW', history:[{from:'UNDER_AUTOMATED_REVIEW', to:'UNDER_ADMIN_REVIEW', actor:'system', at}], notes:[]}`

### POST /admin/credit-applications/:id/request-information — Demander doc
- **Roles**: `ADMIN+`
- **Body**: `{reason: string (10-2000), documents: string[] codes requis}`
- **Validation**: `reason` 10-2000
- **Response 200**: `{id, status:'MORE_INFORMATION_REQUIRED', historyEntry}`
- **Idempotence**: oui (`X-Idempotency-Key`)
- **Audit**: `admin.request_information` + `hash`

### POST /admin/credit-applications/:id/approve — Approuver
- **Roles**: `ADMIN+`
- **Body**: `{note?: string}`
- **Validation**: `status` doit être `UNDER_ADMIN_REVIEW`
- **Response 200**: `{id, status:'APPROVED', decidedBy, decidedAt, auditHash}`
- **Idempotence**: oui
- **Erreurs**: `409 NOT_REVIEWABLE`, `403 KYC_NOT_VERIFIED`
- **Audit**: `admin.approve`

### POST /admin/credit-applications/:id/approve-with-exception — Dérogation
- **Roles**: `ADMIN+` (si `amount <=50000` sinon `SUPER_ADMIN` 403)
- **Body**: `{exceptionReason: string (20-2000, obligatoire), note?: string}`
- **Validation**: `exceptionReason` 20-2000, `rules.failed` non vide, `isHard` false (si hard → toujours `SUPER_ADMIN`)
- **Response 200**: `{id, status:'APPROVED_WITH_EXCEPTION', exceptionReason, rules:{failed}, auditHash}`
- **Idempotence**: oui
- **Erreurs**: `400 MISSING_EXCEPTION_REASON`, `403 REQUIRES_SUPER_ADMIN (amount>50000)`
- **Audit**: `admin.approve_exception` avec `before {rules, values}` + `hash`

### POST /admin/credit-applications/:id/reject — Rejeter
- **Roles**: `ADMIN+`
- **Body**: `{reason: string (10-2000)}`
- **Validation**: `reason` 10-2000
- **Response 200**: `{id, status:'REJECTED', reason, auditHash}`
- **Idempotence**: oui
- **Audit**: `admin.reject`

### GET /admin/loans — Prêts actifs
- **Roles**: `ADMIN+`
- **Query**: `?status=ACTIVE&page=1`
- **Response 200**: `{data:[{id, customer, principal, monthly, nextDue, overdue}], meta}`

### GET /admin/payments — Paiements (PSP)
- **Roles**: `ADMIN+`
- **Query**: `?status=SUCCEEDED&provider=mollie&page=1`
- **Response 200**: `{data:[{id, loan_id, amount, status, provider_payment_id, provider:'mollie', created_at}], meta}`

### GET /admin/investments — Investissements global
- **Roles**: `ADMIN+`
- **Response 200**: `{totalSubscribers:1200, totalAmount:8200000, byProduct:[{code, total, count}], positions:[{customer, product, amount}]}`

### GET /admin/audit-logs — Audit hash-chaîné
- **Roles**: `ADMIN+`
- **Query**: `?entity=credit_application&entityId=KRD-0842&page=1`
- **Response 200**: `{data:[{id, actor:'admin@kredit.be', action:'admin.approve_exception', entity:'KRD-0842', before:{status:'UNDER_ADMIN_REVIEW'}, after:{status:'APPROVED_WITH_EXCEPTION'}, reason, hash:'a3f9...', prev_hash:'9c1e...', createdAt:'2026-09-09T09:15:00Z', ip}], meta}`

---

## 8. Super Admin — `SUPER_ADMIN` + MFA

`403` si `ADMIN` tente ces routes. `SUPER_ADMIN` peut tout `ADMIN`.

### GET /admin/settings — Params globaux
- **Roles**: `SUPER_ADMIN` (lecture `ADMIN` 403 ou lecture seule selon config)
- **Response 200**: `{countries:[{code:'BE', locales:['fr','nl','de'], currency:'EUR'}], locales:['fr','en','nl','de'], features:{mfa:true}, integrations:{mollie:true}}`

### PUT /admin/settings
- **Roles**: `SUPER_ADMIN`, MFA re-auth
- **Body**: `{countries?, locales?, params?, integrations?}` whitelist
- **Response 200**: `{updated}`
- **Idempotence**: oui
- **Audit**: `super.settings.update`

### GET /admin/rules — Règles métier
- **Roles**: `SUPER_ADMIN`
- **Response 200**: `{data:[{id, product_type:'PERSONAL', country:'BE', key:'max_debt_ratio', value:0.33, is_hard:false, needs_legal_validation:false, validated_by_legal_at, effective_from}], meta}`

### POST /admin/rules
- **Roles**: `SUPER_ADMIN`
- **Body**: `{product_type, country_code, key, value, is_hard, needs_legal_validation}`
- **Validation**: `key` enum, `value` type selon `key`, `country_code` BE
- **Response 201**: `{id, ...}`
- **Idempotence**: oui
- **Audit**: `super.rule.create`

### PUT /admin/rules/:id
- **Roles**: `SUPER_ADMIN`
- **Body**: `{value?, is_hard?, needs_legal_validation?}`
- **Response 200**: `{id, ...updated, version:2}`
- **Idempotence**: oui
- **Audit**: `super.rule.update` (hash)

### GET /admin/rate-rules — Taux
- **Roles**: `SUPER_ADMIN`
- **Response 200**: `{data:[{id, product_type:'PERSONAL', country:'BE', min_amount:10001, max_amount:25000, min_term:12, max_term:60, base_rate:0.0421, fees:{filePct:0.01}}], meta}`

### POST /admin/rate-rules
- **Roles**: `SUPER_ADMIN`
- **Body**: `{product_type, country_code, min_amount, max_amount, min_term, max_term, base_rate, fees}`
- **Validation**: `base_rate 0-0.2`, `min_amount < max_amount`
- **Response 201**: `{id}`
- **Idempotence**: oui
- **Audit**: `super.rate.create`

### PUT /admin/rate-rules/:id
- **Roles**: `SUPER_ADMIN`
- **Body**: `{base_rate?, fees?}`
- **Response 200**: `{...updated}`
- **Audit**: `super.rate.update`

### GET /admin/administrators — Liste admins
- **Roles**: `SUPER_ADMIN`
- **Response 200**: `{data:[{id, email:'admin@kredit.be', role:'ADMIN', mfa_enabled:true, created_at}], meta}`

### POST /admin/administrators — Créer admin
- **Roles**: `SUPER_ADMIN`
- **Body**: `{email: string (email), role: 'ADMIN'|'SUPER_ADMIN', tempPassword: string}`
- **Validation**: `email` unique, `password` 12+ chars, `role` enum
- **Response 201**: `{id, email, role, mfa_required:true}`
- **Idempotence**: oui
- **Audit**: `super.admin.create`

### PUT /admin/administrators/:id — Modifier rôle/désactiver
- **Roles**: `SUPER_ADMIN`
- **Body**: `{role?: 'ADMIN'|'SUPER_ADMIN', is_active?: boolean}`
- **Validation**: pas d’auto-désactivation du dernier `SUPER_ADMIN`
- **Response 200**: `{id, ...}`
- **Audit**: `super.admin.update`

---

## 9. Erreurs — enveloppe uniforme

```json
{
  "statusCode": 422,
  "message": "Montant supérieur au plafond de 50000 pour PERSONAL en BE.",
  "code": "CREDIT_AMOUNT_EXCEEDS_CEILING",
  "details": [{ "field":"amount", "issue":"max 50000" }],
  "requestId":"req_9c1e",
  "timestamp":"2026-09-11T09:00:00.000Z"
}
```

| Code | HTTP | Quand |
|------|------|-------|
| `INVALID_CREDENTIALS` | 401 | login |
| `MFA_REQUIRED` | 401 | login sans totp |
| `FORBIDDEN` | 403 | ADMIN tente SUPER_ADMIN |
| `NOT_FOUND` | 404 | id inconnu |
| `EMAIL_ALREADY_EXISTS` | 409 | register |
| `IDEMPOTENCY_CONFLICT` | 409 | même clé, payload différent |
| `VALIDATION_FAILED` | 422 | DTO |
| `CREDIT_AMOUNT_EXCEEDS_CEILING` | 422 | simulation |
| `MISSING_EXCEPTION_REASON` | 400 | approve-with-exception |
| `REQUIRES_SUPER_ADMIN` | 403 | amount>50000 |
| `RATE_LIMITED` | 429 | throttler |

---

## 10. Idempotence & Audit — résumé

| Endpoint | Idempotence | Audit |
|----------|-------------|-------|
| `POST /auth/register` | oui (`X-Idempotency-Key`) | `auth.register` |
| `POST /credit/applications` | oui | `application.created` |
| `POST /credit/simulations` | non (GET cache) | non |
| `PUT /credit/applications/:id` | oui | `application.updated` |
| `POST .../approve*` | oui | `admin.approve*` + hash |
| `POST /payments` | oui | `payment.created` |
| `POST /investments` | oui | `investment.subscribed` |
| `GET` listes | non | non |

Tout `POST` sensible sans `X-Idempotency-Key` → `400 MISSING_IDEMPOTENCY_KEY` si `required`.

---

## 11. OpenAPI / Swagger

- **UI** : `GET /api/docs` (Swagger UI, Bearer `Authorize`)
- **JSON** : `GET /api/docs-json` (OpenAPI 3.1)
- **Génération** : `SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('KREDIT API').setVersion('1.0.0').addBearerAuth().addApiKey({type:'apiKey', in:'header', name:'X-Idempotency-Key'}, 'idempotency').build())`
- **Fichier** : `docs/openapi.json` (exporté via `npm run openapi:export`)

Exemple `openapi.json` extrait :
```json
{
  "openapi":"3.1.0",
  "info":{"title":"KREDIT API","version":"1.0.0"},
  "servers":[{"url":"https://api.kredit.be/api/v1"}],
  "paths":{
    "/auth/login":{"post":{"tags":["Auth"],"requestBody":{"content":{"application/json":{"schema":{"type":"object","properties":{"email":{"type":"string"},"password":{"type":"string"}}}}},"responses":{"200":{"description":"JWT"}}}} }
  }
}
```
