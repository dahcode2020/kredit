# KREDIT — Système de Notifications

> Canaux : WhatsApp Business Platform (Cloud API officielle) · Email · SMS · Push PWA — Service indépendant — i18n FR/EN/NL/DE — idempotent — retry — logs — RGPD.

---

## 1. Architecture

```
[Domain Events] ──► [Notifications Dispatcher] ──► [Preferences + Templates i18n] ──► [Outbox per Channel]
   application.submitted \                          (locale, consent, dispo)         ┌─► Queue: email
   otp.requested          \                                                       ├─► Queue: sms
   application.approved    ──► EventBus (Redis/BullMQ)  ──► Dispatcher Worker      ├─► Queue: whatsapp
   payment.due              /                                                    └─► Queue: push
   ...                       ──► Audit (hash)                                    Chaque → Sender Worker → Provider
                                                                                     → Webhook (delivery/read) → logs
```

**Service indépendant :** `backend/src/modules/notifications/` — aucune dépendance circulaire. Les domaines émettent des **événements** (`EventEmitter2`), le dispatcher **ne connaît pas** les détails métier, seulement `{event, entityId, customerId, locale, payload}`.

**Providers :**

- **Email :** AWS SES (EU `eu-central-1`) primary, fallback SendGrid. From `no-reply@kredit.be` (i18n `KREDIT — Belgique`). DKIM/SPF/DMARC. MJML → HTML.
- **SMS :** Twilio (BE) + Vonage fallback. Sender `KREDIT` (11c), encodage GSM-7, 160c, lien court `kredit.be/r/{token}`.
- **WhatsApp Business Platform :** Cloud API officielle (`graph.facebook.com/v20.0/{PHONE_ID}/messages`), `WABA_ID`, `access_token` en Vault, templates HSM approuvés Meta. Webhook vérifié `hub.verify_token`.
- **Push PWA :** Web Push (VAPID `vapidKeys` serveur, `PushSubscription` client stockée `push_subscriptions` table), via `web-push` lib. Service Worker `sw.js` (Workbox) gère `push` + `notificationclick`.

**Secrets :** jamais côté frontend. Stockés en `Vault / AWS Secrets Manager` → injectés `process.env` → `ConfigService`. Frontend reçoit seulement `vapidPublicKey`.

---

## 2. Événements (13)

| Événement | Déclencheur | Canaux par défaut (configurable) |
|-----------|-------------|-----------------------------------|
| `ACCOUNT_CREATED` | `POST /auth/register` | Email (obligatoire) + Push |
| `OTP_REQUESTED` | `POST /auth/otp` | SMS + WhatsApp (fallback Email) |
| `APPLICATION_STARTED` | `POST /applications` DRAFT | Push |
| `APPLICATION_SUBMITTED` | `SUBMITTED` | Email + WhatsApp + Push |
| `DOCUMENT_REQUIRED` | `MORE_INFO_REQUESTED` | Email + SMS + WhatsApp + Push |
| `APPLICATION_UNDER_REVIEW` | `UNDER_ADMIN_REVIEW` | Email + Push |
| `APPLICATION_APPROVED` | `DECIDED_APPROVED` | **Email + WhatsApp + Push** |
| `APPLICATION_APPROVED_EXCEPTION` | `APPROVED_WITH_EXCEPTION` | Email + WhatsApp + Push (+ note motif interne, pas au client) |
| `APPLICATION_REJECTED` | `DECIDED_REJECTED` | Email + Push (+ SMS si opt-in) |
| `CONTRACT_READY` | PDF contrat signé | Email + WhatsApp + Push |
| `PAYMENT_RECEIVED` | webhook PSP `CONFIRMED` | Email + Push |
| `PAYMENT_DUE` | cron J-3 échéance | Email + SMS + Push (WhatsApp si opt-in) |
| `PAYMENT_OVERDUE` | cron J+1 impayé | Email + SMS + WhatsApp + Push |

Chaque événement peut déclencher **1..4 canaux** selon `notification_preferences` + `channel_availability` (feature flag) + `consent`.

**Exemple `APPLICATION_APPROVED` :**
```
event APPLICATION_APPROVED {applicationId:KRD-0842, customerId:CUST-101, locale:fr, amount:15000}
 → template email:fr → SES → log SENT
 → template whatsapp:fr (HSM kredit_approved_fr) → Cloud API → log SENT / DELIVERED via webhook
 → template push:fr → web-push → log SENT
```

---

## 3. Tables

```sql
-- Templates versionnés, i18n
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL, -- ACCOUNT_CREATED etc.
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL','SMS','WHATSAPP','PUSH')),
  locale TEXT NOT NULL CHECK (locale IN ('fr','en','nl','de')),
  subject TEXT, -- email/push title, null pour sms/whatsapp
  body TEXT NOT NULL, -- MJML/html pour email, txt pour sms/push, json pour whatsapp
  whatsapp_hsm_id TEXT, -- ex: kredit_approved_fr, approuvé Meta
  whatsapp_template_name TEXT,
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event, channel, locale, version)
);
CREATE INDEX idx_tpl_event_locale ON notification_templates(event, channel, locale) WHERE is_active;

-- Préférences & consentement (RGPD)
CREATE TABLE notification_preferences (
  customer_id UUID REFERENCES users(id) PRIMARY KEY,
  locale TEXT NOT NULL DEFAULT 'fr',
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  -- granulaire par event
  preferences JSONB DEFAULT '{}', -- { "PAYMENT_DUE": {"sms":true, "whatsapp":false} }
  consent_whatsapp_at TIMESTAMPTZ,
  consent_sms_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Outbox / logs (append-only)
CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL, -- eventId + channel + locale + recipient + version
  event TEXT NOT NULL,
  channel TEXT NOT NULL,
  locale TEXT NOT NULL,
  recipient TEXT NOT NULL, -- email / phone / push endpoint
  template_id UUID REFERENCES notification_templates(id),
  payload JSONB NOT NULL, -- variables interpolées (sans PII sensible loggée en clair → hash)
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENDING','SENT','DELIVERED','READ','FAILED','BOUNCED')),
  attempts INT DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ,
  provider_ref TEXT, -- SES messageId, Twilio SID, WhatsApp wamid
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_outbox_status ON notification_outbox(status, channel);
CREATE INDEX idx_outbox_idemp ON notification_outbox(idempotency_key);

-- Abonnements Push
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id),
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhooks log
CREATE TABLE notification_webhooks (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL, -- whatsapp/twilio/ses
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Seed templates :** 13 events × 4 channels × 4 locales = max 208 lignes (seulement combinaisons utiles).

---

## 4. Queues & Workers (BullMQ + Redis)

**Queues :**

- `notifications.dispatch` (concurrency 10) — reçoit les domain events, résout locale/préférences/templates, crée `outbox` rows `PENDING` + enqueues `notifications.send.{channel}`.
- `notifications.send.email` (conc 5, rate 14/s SES)
- `notifications.send.sms` (conc 10, rate 10/s Twilio)
- `notifications.send.whatsapp` (conc 5, rate 20/s Cloud API)
- `notifications.send.push` (conc 20)
- `notifications.retry` (delayed, backoff)
- `notifications.dlq` (dead-letter, alert Ops)

**Dispatcher worker (pseudo) :**

```ts
@Processor('notifications.dispatch')
async handle(event: DomainEvent) {
  const { event: ev, customerId } = event;
  const cust = await customers.findOne(customerId);
  const locale = cust.locale ?? 'fr';
  const prefs = await prefs.findOne(customerId);
  const channels = this.resolveChannels(ev, prefs, cust); // ex: [EMAIL, WHATSAPP, PUSH]
  for (const ch of channels) {
    const tpl = await templates.findActive(ev, ch, locale) ?? fallback('fr');
    const idem = `${ev}:${event.entityId}:${ch}:${locale}:${cust.email ?? cust.phone}`;
    await outbox.insertOnConflictDoNothing({ idempotency_key:idem, event:ev, channel:ch, locale, recipient: resolveRecipient(ch,cust), template_id:tpl.id, payload: interpolate(tpl.body, event.payload) });
    await this.queue.add(`send.${ch.toLowerCase()}`, { outboxId, ch, locale }, { jobId:idem, removeOnComplete:1000 });
  }
}
```

**Sender worker (ex email) :**

```ts
@Processor('notifications.send.email')
async send(job) {
  const row = await outbox.findOne(job.data.outboxId);
  if (row.status === 'SENT') return; // idempotent
  try {
    await outbox.update(row.id, { status:'SENDING', attempts: row.attempts+1 });
    const res = await ses.send({ to: row.recipient, subject: row.template.subject, html: mjml2html(row.payload.html) });
    await outbox.update(row.id, { status:'SENT', provider_ref: res.MessageId, sent_at: now() });
    await audit.log({ action:'notification.sent', entity:'notification', entityId:row.id, after:{ channel:row.channel, locale:row.locale } });
  } catch(e) {
    if (isTransient(e) && row.attempts < 5) throw e; // BullMQ retry with backoff
    await outbox.update(row.id, { status:'FAILED', last_error:e.message });
    await dlq.add({ row, error:e });
  }
}
```

---

## 5. Retry, Idempotence, Gestion erreurs

- **Retry :** BullMQ `attempts:5` + `backoff: {type:'exponential', delay: 2000}` → `2s,4s,8s,16s,32s`. Seuls erreurs **transitoires** (timeout, 429, 5xx) retentent. Erreurs **permanentes** (400, template not found, invalid phone) → `FAILED` direct + DLQ.
- **Idempotence :** `idempotency_key` unique DB + `jobId` BullMQ identique. Dispatcher `INSERT ... ON CONFLICT DO NOTHING` garantit un seul envoi même si event redélivré. Sender vérifie `status` avant envoi. Webhook `provider_ref` dédupliqué.
- **DLQ :** job `notifications.dlq` → alerte `Sentry` + `audit` + dashboard admin (table `FAILED` avec retry manuel `Rejouer`).
- **Timeouts :** provider `timeout 10s`, circuit breaker (5 échecs → open 60s).
- **Logs :** `outbox` + `notification_webhooks` + `audit_logs` (corrélation `x-request-id`). Logs structurés `pino` (`event`, `channel`, `locale`, `attempt`, `duration`).

---

## 6. Webhooks

- **WhatsApp :** `POST /api/v1/webhooks/whatsapp` — vérifie `hub.verify_token` (GET), valide signature `X-Hub-Signature-256` (HMAC SHA256 `APP_SECRET`), traite `statuses: [sent, delivered, read, failed]` → met à jour `outbox.status` + `delivered_at/read_at`.
- **SES :** `POST /api/v1/webhooks/ses` (SNS) → `delivery/bounce/complaint` → `DELIVERED/BOUNCED`.
- **Twilio :** `POST /api/v1/webhooks/twilio` → `delivered/undelivered` → `DELIVERED/FAILED`.
- **Sécurité :** IP allowlist + signature + idempotence `provider_ref`.

---

## 7. Consentement & préférences

- **Opt-in :** `consent_whatsapp_at` et `consent_sms_at` requis avant premier envoi (case à cocher RGPD dans onboarding, log consent version). `EMAIL` opt-in implicite (compte), désabonnement possible sauf `ACCOUNT_CREATED/OTP_REQUESTED` (transactionnel).
- **Préférences :** `/fr/settings` → toggles par canal + par événement (`PAYMENT_DUE: sms off`). API `PUT /api/v1/customers/me/preferences`. Dispatcher filtre `prefs`.
- **Disponibilité canal :** kill-switch `config/notifications.json` (`email.enabled`, `whatsapp.enabled`).
- **Langue :** toujours `customer.locale` au moment de l'événement. Si le client change de langue après, le message déjà en queue garde sa locale d'origine.

---

## 8. Templates — exemples (4 langues)

### 8.1 EMAIL — `APPLICATION_APPROVED`

- **fr** subject `Votre crédit KRD-{{id}} est approuvé — contrat prêt` body MJML `Bonjour {{name}},<br>Bonne nouvelle : votre demande {{id}} ({{amount}} sur {{term}} mois) a été <strong>approuvée</strong> par notre équipe.<br>Mensualité {{monthly}} — TAEG {{taeg}} — <a href="{{contractUrl}}">Consulter le contrat</a>.<br><small>Simulation indicative — offre soumise à signature.</small>`
- **en** `Your loan KRD-{{id}} is approved — contract ready` `Hello {{name}}, your application {{id}} ({{amount}} over {{term}} months) has been approved…`
- **nl** `Uw krediet KRD-{{id}} is goedgekeurd — contract klaar` `Hallo {{name}}, uw aanvraag {{id}} ({{amount}} over {{term}} maanden) is goedgekeurd…`
- **de** `Ihr Kredit KRD-{{id}} ist genehmigt — Vertrag bereit` `Hallo {{name}}, Ihr Antrag {{id}} ({{amount}} auf {{term}} Monate) wurde genehmigt…`

### 8.2 SMS — `PAYMENT_DUE` (GSM-7, 140c)

- fr `KREDIT: echeance {{amount}} le {{date}}. Payez via {{url}}. STOP au {{stop}}`
- en `KREDIT: payment {{amount}} due {{date}}. Pay via {{url}}. STOP {{stop}}`
- nl `KREDIT: vervaldag {{amount}} op {{date}}. Betaal via {{url}}. STOP {{stop}}`
- de `KREDIT: Faelligkeit {{amount}} am {{date}}. Zahlen via {{url}}. STOP {{stop}}`

### 8.3 WhatsApp HSM — `APPLICATION_APPROVED` (approuvé Meta)

- **Name** `kredit_approved_fr` / `_en` / `_nl` / `_de` — Catégorie `MARKETING` ou `UTILITY`, langue `fr`/`en_US`/`nl`/`de`.
- **fr** `Bonjour {{1}}, votre demande {{2}} est approuvée. Montant {{3}} — mensualité {{4}}. Contrat : {{5}}. — KREDIT`
- **en** `Hello {{1}}, your application {{2}} is approved. Amount {{3}} — monthly {{4}}. Contract: {{5}}. — KREDIT`
- **nl** `Hallo {{1}}, uw aanvraag {{2}} is goedgekeurd. Bedrag {{3}} — maandlast {{4}}. Contract: {{5}}. — KREDIT`
- **de** `Hallo {{1}}, Ihr Antrag {{2}} ist genehmigt. Betrag {{3}} — Rate {{4}}. Vertrag: {{5}}. — KREDIT`
- Variables `{{1}}=prénom, {{2}}=id, {{3}}=formatCurrency, {{4}}=formatCurrency, {{5}}=shortUrl`

### 8.4 PUSH — `DOCUMENT_REQUIRED`

- fr `Documents manquants` / `Votre dossier KRD-{{id}} attend {{doc}}.`
- en `Documents required` / `Your file KRD-{{id}} needs {{doc}}.`
- nl `Documenten vereist` / `Uw dossier KRD-{{id}} wacht op {{doc}}.`
- de `Unterlagen erforderlich` / `Ihr Antrag KRD-{{id}} benötigt {{doc}}.`

Tous les templates utilisent `{{var}}` + filtres `{{amount | currency:locale}}`, `{{date | date:locale}}`.

---

## 9. Interface admin

`/[locale]/admin/notifications` (ADMIN lecture, SUPER_ADMIN écriture) + `.../templates` :

- Table `event × channel × locale` avec `subject/body/status/version`, filtres `event/channel/locale`, search.
- Actions : `Voir / Dupliquer / Éditer / Prévisualiser (avec variables fictives)` + `Activer/Désactiver` + `Historique versions`.
- **WhatsApp** : badge `Approuvé Meta ✓` / `En attente` / `Rejeté`, bouton `Soumettre à Meta` (crée brouillon Cloud API, admin colle `template_id`).
- **Test** : bouton `Envoyer test` → envoie à `admin@kredit.be` via vraie queue mais `test=true` (pas log client).
- **Logs** : onglet `Envois` → table `outbox` filtrable (`event, channel, locale, status, recipient`), `Rejouer` sur `FAILED`, export CSV.

---

## 10. Sécurité & RGPD

- Secrets en Vault, jamais exposés. `vapidPublicKey` seul côté client.
- PII minimisée : `payload` loggue `hash(email)` pas l'email en clair si `PII_MASK=true`.
- Rétention `outbox` 13 mois, `webhooks` 90j.
- Droit à l'oubli : `DELETE /customers/me` → purge `push_subscriptions` + `preferences`.
- Rate-limit dispatcher `100 events/s`, sender `SES 14/s`.

---

## 11. Diagramme séquence — `APPLICATION_APPROVED` → 3 canaux

```
Customer → POST /applications/KRD-0842/decision {APPROVED} (ADMIN)
  → Event application.approved {KRD-0842, CUST-101, locale:fr}
  → Dispatcher: locale=fr, prefs=[email:on, whatsapp:on, push:on]
  → INSERT outbox 3 rows (idem keys) → enqueue 3 jobs
  → email worker → SES → SENT → webhook delivered → DELIVERED
  → whatsapp worker → Cloud API wamid.123 → SENT → webhook read → READ
  → push worker → web-push → SENT
  → audit.log + SSE /fr/notifications (temps réel)
```

---

## 12. Checklist prod

- [x] Migration SQL + seed 4 langues
- [x] Dispatcher + 4 senders + retry + DLQ
- [x] Webhooks WhatsApp/SES/Twilio vérifiés
- [x] Templates i18n 13 events × 4 locales
- [x] Admin UI CRUD + prévisualisation
- [x] Consent + préférences + locale
- [ ] Approbation Meta HSM (soumission)
- [ ] Tests e2e par locale (fr/en/nl/de) + idempotence
- [ ] Dash Grafana (taux délivrance, retry, DLQ)

