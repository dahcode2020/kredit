-- 003_notifications_i18n.sql — i18n complete + notifications multi-canal
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- locales allowed
DO $$ BEGIN
  CREATE TYPE locale_code AS ENUM ('fr','en','nl','de');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE notif_channel AS ENUM ('EMAIL','SMS','WHATSAPP','PUSH');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE notif_status AS ENUM ('PENDING','SENDING','SENT','DELIVERED','READ','FAILED','BOUNCED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Templates versionnés, i18n (13 events × 4 canaux × 4 locales)
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL CHECK (event IN ('ACCOUNT_CREATED','OTP_REQUESTED','APPLICATION_STARTED','APPLICATION_SUBMITTED','DOCUMENT_REQUIRED','APPLICATION_UNDER_REVIEW','APPLICATION_APPROVED','APPLICATION_APPROVED_EXCEPTION','APPLICATION_REJECTED','CONTRACT_READY','PAYMENT_RECEIVED','PAYMENT_DUE','PAYMENT_OVERDUE')),
  channel notif_channel NOT NULL,
  locale locale_code NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  whatsapp_hsm_id TEXT,
  whatsapp_template_name TEXT,
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event, channel, locale, version)
);
CREATE INDEX IF NOT EXISTS idx_tpl_event_locale ON notification_templates(event, channel, locale) WHERE is_active;

-- Préférences & consentement (RGPD)
CREATE TABLE IF NOT EXISTS notification_preferences (
  customer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale locale_code NOT NULL DEFAULT 'fr',
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  preferences JSONB DEFAULT '{}',
  consent_whatsapp_at TIMESTAMPTZ,
  consent_sms_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Outbox / logs append-only
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  event TEXT NOT NULL,
  channel notif_channel NOT NULL,
  locale locale_code NOT NULL,
  recipient TEXT NOT NULL,
  template_id UUID REFERENCES notification_templates(id),
  payload JSONB NOT NULL,
  status notif_status NOT NULL DEFAULT 'PENDING',
  attempts INT DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ, delivered_at TIMESTAMPTZ, read_at TIMESTAMPTZ,
  provider_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON notification_outbox(status, channel);
CREATE INDEX IF NOT EXISTS idx_outbox_idemp ON notification_outbox(idempotency_key);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_webhooks (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed minimal templates (APPLICATION_APPROVED × 4 canaux × 4 locales = 16 exemples, les 12 autres events seed via script)
INSERT INTO notification_templates (event, channel, locale, subject, body, whatsapp_template_name) VALUES
-- EMAIL
('APPLICATION_APPROVED','EMAIL','fr','Votre crédit KRD-{{id}} est approuvé — contrat prêt','Bonjour {{name}},<br>Bonne nouvelle : votre demande {{id}} ({{amount}} sur {{term}} mois) a été <strong>approuvée</strong>.<br>Mensualité {{monthly}} — TAEG {{taeg}} — <a href="{{contractUrl}}">Consulter le contrat</a>.<br><small>Simulation ≠ offre.</small>', null),
('APPLICATION_APPROVED','EMAIL','en','Your loan KRD-{{id}} is approved — contract ready','Hello {{name}},<br>Your application {{id}} ({{amount}} over {{term}} months) has been <strong>approved</strong>.<br>Monthly {{monthly}} — APR {{taeg}} — <a href="{{contractUrl}}">View contract</a>.', null),
('APPLICATION_APPROVED','EMAIL','nl','Uw krediet KRD-{{id}} is goedgekeurd — contract klaar','Hallo {{name}},<br>Uw aanvraag {{id}} ({{amount}} over {{term}} maanden) is <strong>goedgekeurd</strong>.<br>Maandlast {{monthly}} — JKP {{taeg}} — <a href="{{contractUrl}}">Contract bekijken</a>.', null),
('APPLICATION_APPROVED','EMAIL','de','Ihr Kredit KRD-{{id}} ist genehmigt — Vertrag bereit','Hallo {{name}},<br>Ihr Antrag {{id}} ({{amount}} auf {{term}} Monate) wurde <strong>genehmigt</strong>.<br>Rate {{monthly}} — Effektivzins {{taeg}} — <a href="{{contractUrl}}">Vertrag ansehen</a>.', null),
-- SMS
('PAYMENT_DUE','SMS','fr',null,'KREDIT: echeance {{amount}} le {{date}}. Payez via {{url}}. STOP au {{stop}}', null),
('PAYMENT_DUE','SMS','en',null,'KREDIT: payment {{amount}} due {{date}}. Pay via {{url}}. STOP {{stop}}', null),
('PAYMENT_DUE','SMS','nl',null,'KREDIT: vervaldag {{amount}} op {{date}}. Betaal via {{url}}. STOP {{stop}}', null),
('PAYMENT_DUE','SMS','de',null,'KREDIT: Faelligkeit {{amount}} am {{date}}. Zahlen via {{url}}. STOP {{stop}}', null),
-- WHATSAPP HSM (approuvés Meta)
('APPLICATION_APPROVED','WHATSAPP','fr',null,'Bonjour {{1}}, votre demande {{2}} est approuvée. Montant {{3}} — mensualité {{4}}. Contrat : {{5}}. — KREDIT','kredit_approved_fr'),
('APPLICATION_APPROVED','WHATSAPP','en',null,'Hello {{1}}, your application {{2}} is approved. Amount {{3}} — monthly {{4}}. Contract: {{5}}. — KREDIT','kredit_approved_en'),
('APPLICATION_APPROVED','WHATSAPP','nl',null,'Hallo {{1}}, uw aanvraag {{2}} is goedgekeurd. Bedrag {{3}} — maandlast {{4}}. Contract: {{5}}. — KREDIT','kredit_approved_nl'),
('APPLICATION_APPROVED','WHATSAPP','de',null,'Hallo {{1}}, Ihr Antrag {{2}} ist genehmigt. Betrag {{3}} — Rate {{4}}. Vertrag: {{5}}. — KREDIT','kredit_approved_de'),
-- PUSH
('DOCUMENT_REQUIRED','PUSH','fr','Documents manquants','Votre dossier KRD-{{id}} attend {{doc}}.', null),
('DOCUMENT_REQUIRED','PUSH','en','Documents required','Your file KRD-{{id}} needs {{doc}}.', null),
('DOCUMENT_REQUIRED','PUSH','nl','Documenten vereist','Uw dossier KRD-{{id}} wacht op {{doc}}.', null),
('DOCUMENT_REQUIRED','PUSH','de','Unterlagen erforderlich','Ihr Antrag KRD-{{id}} benötigt {{doc}}.', null)
ON CONFLICT DO NOTHING;
