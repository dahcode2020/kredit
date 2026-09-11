# KREDIT — Module Paiement

> Indépendant du fournisseur — `PaymentProvider` abstraction — idempotence — vérification serveur seule — confirmation admin/super admin suffisante — webhooks signés — rapprochement — reçus — audit.

---

## 1. Principes

- **Jamais `paid` sur succès navigateur** : le front peut afficher `processing`, seul `PaymentWebhookService` (source serveur fiable : webhook PSP signé ou confirmation admin) peut passer `SUCCEEDED`.
- **Indépendance fournisseur** : domaine dépend de `PaymentProvider` (interface), jamais de Mollie/Stripe. `MollieProvider`, `StripeProvider`, `MockProvider`, `AdminConfirmProvider` branchables via DI.
- **Idempotence stricte** : `idempotency_key = hash(customerId + loanId + installmentIds + amount + provider)` unique DB + `X-Idempotency-Key` header. Rejeu = même réponse sans double débit.
- **Audit & traçabilité** : chaque transition `PaymentTransaction` → `audit_logs` hash-chaîné + `provider_id` conservé.

---

## 2. Modèle `Loan → LoanInstallment → Payment → PaymentTransaction`

```
Loan (contrat) 1—N LoanInstallment (échéancier) 1—N Payment (tentative) 1—N PaymentTransaction (appel provider)
```

### 2.1 `Loan`
Contrat débloqué après `DECIDED_APPROVED`. Généré depuis `applications` + `schedules`.

| Champ | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `application_id` | UUID FK | `applications.id` |
| `customer_id` | UUID FK | `users.id` |
| `provider` | TEXT | `mollie`/`stripe`/`admin` |
| `principal` | NUMERIC(15,2) | montant financé |
| `taeg` | NUMERIC(5,4) | taux contractuel |
| `term_months` | INT | durée |
| `monthly_amount` | NUMERIC(15,2) | échéance théorique |
| `fees` | JSONB | `{ file: 150, insurance: ... }` |
| `status` | `loan_status` | voir §3 |
| `disbursed_at` | TIMESTAMPTZ | `admin confirm` ou `psp webhook` |
| `closed_at` | TIMESTAMPTZ | soldé |

### 2.2 `LoanInstallment` (échéance)
Générée `N=term_months` lignes amortissement français.

| Champ | Type |
|-------|------|
| `id` | UUID |
| `loan_id` | UUID FK |
| `number` | INT 1..N |
| `due_date` | DATE |
| `principal_due` | NUMERIC |
| `interest_due` | NUMERIC |
| `fees_due` | NUMERIC |
| `total_due` | NUMERIC |
| `principal_paid` | NUMERIC default 0 |
| `interest_paid` | NUMERIC |
| `fees_paid` | NUMERIC |
| `status` | `installment_status` |
| `paid_at` | TIMESTAMPTZ |

### 2.3 `Payment` (intention de payer)
Une tentative utilisateur/admin pour payer 1..N échéances.

| Champ | Type |
|-------|------|
| `id` | UUID |
| `loan_id` | UUID FK |
| `customer_id` | UUID FK |
| `type` | `payment_type` `INSTALLMENT`/`EARLY_REPAYMENT`/`FEES`/`REFUND` |
| `amount` | NUMERIC |
| `currency` | CHAR(3) `EUR` |
| `installment_ids` | UUID[] | échéances visées |
| `idempotency_key` | TEXT UNIQUE |
| `status` | `payment_status` |
| `provider` | TEXT | `mollie`/`stripe`/`admin` |
| `provider_payment_id` | TEXT | `tr_xxxx` Mollie |
| `receipt_url` | TEXT | S3 présigné |
| `confirmed_by` | UUID | admin si `AdminConfirmProvider` |
| `confirmed_at` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ |

### 2.4 `PaymentTransaction` (appel provider)
Chaque appel bas niveau (create, capture, webhook, refund).

| Champ | Type |
|-------|------|
| `id` | UUID |
| `payment_id` | UUID FK |
| `provider` | TEXT |
| `provider_transaction_id` | TEXT | `tr_xxxx` / `pi_xxxx` |
| `type` | `transaction_type` `AUTHORIZATION`/`CAPTURE`/`REFUND`/`CHARGEBACK` |
| `amount` | NUMERIC |
| `status` | `transaction_status` `CREATED`/`AUTHORIZED`/`CAPTURED`/`FAILED`/`REFUNDED` |
| `raw_payload` | JSONB | webhook brut |
| `signature_valid` | BOOLEAN |
| `error_code` | TEXT |
| `created_at` | TIMESTAMPTZ |

---

## 3. États

### `loan_status` : `DRAFT` → `ACTIVE` → `REPAID` / `DEFAULTED` / `CLOSED`
- `DRAFT` : créé mais non débloqué
- `ACTIVE` : `disbursed_at` posé (webhook ou admin)
- `REPAID` : toutes échéances `PAID`
- `DEFAULTED` : impayé >90j (cron)
- `CLOSED` : soldé + frais soldés

### `installment_status` : `PENDING` → `DUE` → `PARTIALLY_PAID` → `PAID` / `OVERDUE` / `WAIVED`
- `PENDING` : future
- `DUE` : `due_date` ≤ today & `total_paid < total_due`
- `OVERDUE` : `DUE` + `today > due_date + grace (3j)`
- `PAID` : `total_paid == total_due`
- `WAIVED` : remise admin (`SUPER_ADMIN` + motif)

### `payment_status` : `PENDING` → `PROCESSING` → `SUCCEEDED` / `FAILED` / `CANCELLED` / `REFUNDED`
- `PENDING` : créé, idempotency réservée
- `PROCESSING` : provider `createPayment` OK, attente webhook
- `SUCCEEDED` : webhook `paid` vérifié **ou** `admin confirm`
- `FAILED` : provider `failed` ou timeout
- `REFUNDED` : remboursement total via `PaymentReconciliationService`

### `transaction_status` : `CREATED` → `AUTHORIZED` → `CAPTURED` / `FAILED` / `REFUNDED`

---

## 4. Flux — Jamais navigateur = payé

```
[Browser] click "Payer 463€" 
  → POST /payments {loanId, installmentIds:[1], amount:463, idempotencyKey: uuid} (X-Idempotency-Key)
  → PaymentService.create() → INSERT Payment PENDING (unique idempotency_key) → provider.createPayment() → retourne { checkoutUrl, provider_payment_id } → Browser redirect checkoutUrl
  → [PSP] user paye → PSP → POST /webhooks/payments/mollie (signé) → PaymentWebhookService.handle() vérifie signature → INSERT PaymentTransaction CAPTURED → UPDATE Payment SUCCEEDED → UPDATE LoanInstallment PAID → génère reçu → audit → event payment.succeeded → notifications
  → Si pas de webhook dans 15m → cron reconciliation → GET provider status → même transition

[Admin] POST /admin/payments/:id/confirm {reason} → même transition SUCCEEDED sans PSP (AdminConfirmProvider) → audit + hash
```

**Browser `success` URL ne passe jamais `SUCCEEDED`** : il affiche `PROCESSING` + polling `GET /payments/:id`. Seul serveur fait foi.

---

## 5. Interfaces — Indépendance fournisseur

```ts
export interface PaymentProvider {
  readonly name: string; // 'mollie' | 'stripe' | 'admin-confirm' | 'mock'
  createPayment(input: CreatePaymentInput): Promise<{ providerPaymentId: string; checkoutUrl?: string; status: string }>;
  getPaymentStatus(providerPaymentId: string): Promise<{ status: string; amount: number; raw: any }>;
  refund(paymentId: string, amount?: number): Promise<{ providerRefundId: string; status: string }>;
  verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean;
}

@Injectable() class MollieProvider implements PaymentProvider { name='mollie'; ... }
@Injectable() class StripeProvider implements PaymentProvider { name='stripe'; ... }
@Injectable() class AdminConfirmProvider implements PaymentProvider { name='admin-confirm'; createPayment = () => ({ providerPaymentId: 'admin-'+uuid(), status:'pending' }); verifyWebhookSignature=()=>true; }

@Module({
  providers: [
    { provide: 'PaymentProvider', useFactory: (cfg: ConfigService) => {
        const p = cfg.get('PAYMENT_PROVIDER'); // mollie | stripe | admin-confirm
        if (p==='stripe') return new StripeProvider();
        if (p==='admin-confirm') return new AdminConfirmProvider();
        return new MollieProvider();
      }, inject: [ConfigService] },
    PaymentService, PaymentWebhookService, PaymentReconciliationService,
  ]
})
```

Domaine (`PaymentService`) ne connaît que `PaymentProvider`.

---

## 6. Idempotence, IDs, Signatures, Retry

- **Idempotency** : header `X-Idempotency-Key: uuid` obligatoire `POST /payments`, `POST /refunds`. DB `UNIQUE(idempotency_key)` + `ON CONFLICT DO NOTHING` → retourne `Payment` existant + `409` ou `200` même payload. Clé TTL 24h (Redis) + DB permanente pour audit.
- **IDs** : `Payment.id` (UUID interne), `Payment.provider_payment_id` (`tr_xxxx` Mollie), `PaymentTransaction.provider_transaction_id`.
- **Webhook signature** : Mollie `X-Mollie-Signature` HMAC SHA256 (`MOLLIE_WEBHOOK_SECRET`), Stripe `Stripe-Signature` HMAC. Vérifiée **avant** tout traitement, sinon `401`.
- **Retry** : `PaymentService` : `3` tentatives `exponential 2s/4s/8s` sur `createPayment` (5xx/timeout). Webhook : PSP retente 24h si `!200`. Notre handler idempotent (même `provider_payment_id` → même `Transaction` → pas de double `SUCCEEDED`).
- **Reconciliation** : cron `0 3 * * *` → `PaymentReconciliationService.reconcile(day)` compare `provider.listPayments(date)` vs `payments` → si `provider=paid` mais `Payment=PROCESSING` → corrige `SUCCEEDED` + alerte.

---

## 7. Cas métier

| Cas | Type | Flux |
|-----|------|------|
| **Échéance** | `INSTALLMENT` | `Payment` 463€ → `Installment #12 PAID` |
| **Frais** | `FEES` | `Payment` 150€ dossier |
| **Anticipé partiel** | `EARLY_REPAYMENT` | `Payment` 5000€ → recalcul échéancier (réduit durée ou mensualité, au choix produit) → `LoanInstallment` régénérées |
| **Anticipé total** | `EARLY_REPAYMENT` | solde `principal_restant + intérêts courus + frais éventuels` → `Loan CLOSED` |
| **Échouée** | `FAILED` | `PaymentTransaction FAILED` → `Payment FAILED` → `Installment DUE` → retry user |
| **Remboursement** | `REFUND` | `POST /payments/:id/refund {amount}` → `provider.refund` → `Payment REFUNDED` + `Installment WAIVED/PAID` ajusté |

---

## 8. Audit & reçus

- Chaque `Payment`/`Transaction` → `audit_logs` `{action:'payment.created'|'payment.succeeded'|'payment.failed'|'payment.refunded', entity, before/after, actor, hash}`.
- Reçu PDF `receipts/{paymentId}.pdf` S3 `SSE-KMS`, URL présignée 15m, i18n `fr/en/nl/de` + `EUR` + `TVA` si frais.
- Logs Pino `payment.*` avec `requestId`, `idempotency_key`, `providerPaymentId` (sans PAN).

---

## 9. Validation juridique BE/EU

- **DSP2** : paiement SEPA via PSP agréé (Mollie `PI`/`EMI`), 3DS si carte, pas de stockage PAN.
- **TAEG/fees** : frais affichés SECCI, pas de frais cachés.
- **Remboursement anticipé** : droit CDE art. VII.147 (indemnité max si prévue contrat).
- **Conservation** : 10 ans `Loan/Payment` (CDE), 5 ans LBC si assujetti.
- **À valider** : qualification `admin confirm` comme preuve paiement (besoin double validation ?).

---

## 10. API

```
POST   /api/v1/payments {loanId, installmentIds, amount, idempotencyKey} → 201 {payment, checkoutUrl}
GET    /api/v1/payments/:id → {payment, transactions}
POST   /api/v1/webhooks/payments/mollie (signé) → 200
POST   /api/v1/webhooks/payments/stripe (signé) → 200
POST   /api/v1/admin/payments/:id/confirm {reason} @Roles('ADMIN') → 200 (AdminConfirmProvider)
POST   /api/v1/admin/payments/:id/refund {amount, reason} @Roles('SUPER_ADMIN') → 200
POST   /api/v1/admin/payments/reconcile {date} @Roles('SUPER_ADMIN') → 200 {fixed: 3}
```

---

## 11. Checklist

- [x] Migration `loans`, `loan_installments`, `payments`, `payment_transactions`
- [x] Interfaces `PaymentProvider` + 4 implémentations
- [x] `PaymentService` idempotent + `PaymentWebhookService` signé + `PaymentReconciliationService` cron
- [x] États §3 + reçus + audit
- [ ] Test e2e `PENDING → SUCCEEDED` via webhook + `ADMIN confirm`
- [ ] Réconciliation quotidienne en prod
