-- ============================================================================
-- KREDIT — Schéma PostgreSQL complet (production-ready)
-- EUR / BE initial, extensible EU — Règles non hardcodées versionnées
-- ============================================================================
-- Compatible PostgreSQL 15+ — exécuter en une passe ou via migrations
-- Ordre : extensions → ENUMs → référentiels pays/langues/devises → IAM →
-- crédit (produits/règles/taux) → simulations → applications → scoring →
-- décisions/exceptions → prêts/échéances/paiements → investissements →
-- KYC → documents → notifications → audit/sécurité
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";        -- email case-insensitive
CREATE EXTENSION IF NOT EXISTS "btree_gin";     -- GIN multi-col

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
DO $$ BEGIN CREATE TYPE locale_code AS ENUM ('fr','en','nl','de'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE currency_code AS ENUM ('EUR','GBP','CHF','USD','SEK','DKK','PLN','CZK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('PENDING_VERIFICATION','ACTIVE','DISABLED','LOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE kyc_status AS ENUM ('NOT_STARTED','IN_REVIEW','VERIFIED','REJECTED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE application_status AS ENUM (
  'DRAFT','SUBMITTED','KYC_PENDING','DOCUMENTS_PENDING',
  'UNDER_AUTOMATED_REVIEW','UNDER_ADMIN_REVIEW','MORE_INFORMATION_REQUIRED',
  'APPROVED','APPROVED_WITH_EXCEPTION','REJECTED',
  'CONTRACT_PENDING','CONTRACT_SIGNED','DISBURSEMENT_PENDING','DISBURSED','CLOSED','CANCELLED'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE credit_product_type AS ENUM ('PERSONAL','MORTGAGE','BUSINESS','AUTO','RENO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE credit_product_status AS ENUM ('DRAFT','ACTIVE','SUSPENDED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rule_category AS ENUM ('eligibility','scoring','docs','fees','limits','pricing'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rule_status AS ENUM ('DRAFT','ACTIVE','ARCHIVED','PENDING_LEGAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE rate_rule_status AS ENUM ('DRAFT','ACTIVE','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE score_grade AS ENUM ('A','B','C','D','E'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE recommendation AS ENUM ('APPROVE_RECOMMENDATION','REVIEW_RECOMMENDATION','REJECT_RECOMMENDATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE final_decision AS ENUM ('APPROVED','REJECTED','APPROVED_WITH_EXCEPTION','PENDING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loan_status AS ENUM ('DRAFT','ACTIVE','REPAID','DEFAULTED','CLOSED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE installment_status AS ENUM ('PENDING','DUE','PARTIALLY_PAID','PAID','OVERDUE','WAIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_type AS ENUM ('INSTALLMENT','EARLY_REPAYMENT','FEES','REFUND'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('PENDING','PROCESSING','SUCCEEDED','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_type AS ENUM ('AUTHORIZATION','CAPTURE','REFUND','CHARGEBACK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_status AS ENUM ('CREATED','AUTHORIZED','CAPTURED','FAILED','REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE investment_product_type AS ENUM ('BOND','FUND','TERM_DEPOSIT','SAVINGS','EQUITY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE investment_product_status AS ENUM ('DRAFT','ACTIVE','SUSPENDED','CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE investor_type AS ENUM ('RETAIL','PROFESSIONAL','ELIGIBLE_COUNTERPARTY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE investment_status AS ENUM ('PENDING','ACTIVE','REDEEMED','CANCELLED','FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE investment_transaction_type AS ENUM ('SUBSCRIPTION','DIVIDEND','REDEMPTION','FEES','REFUND'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE investment_transaction_status AS ENUM ('PENDING','SUCCEEDED','FAILED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE document_type AS ENUM ('ID','PASSPORT','INCOME_3M','PROOF_ADDRESS','BANK_STATEMENTS_3M','TAX_RETURN_2Y','PROPERTY_VALUATION','BUSINESS_PLAN','DEBT_DETAILS','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE document_status AS ENUM ('PENDING','CLEAN','INFECTED','EXPIRED','REJECTED','VERIFIED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE scan_status AS ENUM ('PENDING','CLEAN','INFECTED','ERROR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE kyc_check_type AS ENUM ('IDV','AML','SANCTIONS','FRAUD','PEP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE kyc_check_status AS ENUM ('PENDING','CLEAR','REVIEW','HIT','BLOCKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notif_channel AS ENUM ('EMAIL','SMS','WHATSAPP','PUSH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notif_status AS ENUM ('PENDING','SENDING','SENT','DELIVERED','READ','FAILED','BOUNCED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE actor_type AS ENUM ('CUSTOMER','ADMIN','SUPER_ADMIN','SYSTEM','ANONYMOUS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE entity_type AS ENUM ('USER','CUSTOMER','ADMINISTRATOR','ROLE','PERMISSION','COUNTRY','CREDIT_PRODUCT','CREDIT_RULE','RATE_RULE','SIMULATION','APPLICATION','SCORE','DECISION','EXCEPTION','LOAN','INSTALLMENT','PAYMENT','TRANSACTION','INVESTMENT_PRODUCT','INVESTMENT','KYC','DOCUMENT','NOTIFICATION','TEMPLATE','SESSION','SECURITY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE security_event_type AS ENUM ('LOGIN_FAILED','LOGIN_SUCCESS','LOGOUT','PASSWORD_CHANGE','EMAIL_CHANGE','PHONE_CHANGE','BRUTE_FORCE','RATE_LIMITED','ANOMALY_VELOCITY','ANOMALY_IMPOSSIBLE_TRAVEL','ANOMALY_DEVICE_CHANGE','MFA_FAILED','MFA_SUCCESS','LOCKOUT','UNLOCK','SECRET_ROTATED','BACKUP_CREATED','RESTORE_TESTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Generic trigger for updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. RÉFÉRENTIELS — Pays / Langues / Devises (multi-lang & multi-devises)
-- ============================================================================
CREATE TABLE IF NOT EXISTS currencies (
  code currency_code PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals SMALLINT NOT NULL DEFAULT 2 CHECK (decimals IN (0,2)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO currencies(code,name,symbol) VALUES
  ('EUR','Euro','€'),('GBP','British Pound','£'),('CHF','Swiss Franc','CHF'),('USD','US Dollar','$'),
  ('SEK','Swedish Krona','kr'),('DKK','Danish Krone','kr'),('PLN','Polish Zloty','zł'),('CZK','Czech Koruna','Kč')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS languages (
  code locale_code PRIMARY KEY,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO languages(code,name,native_name) VALUES
  ('fr','French','Français'),('en','English','English'),('nl','Dutch','Nederlands'),('de','German','Deutsch')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS countries (
  code CHAR(2) PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
  name_i18n JSONB NOT NULL, -- {"fr":"Belgique","en":"Belgium","nl":"België","de":"Belgien"}
  currency_code currency_code NOT NULL REFERENCES currencies(code),
  default_locale locale_code NOT NULL DEFAULT 'fr',
  locales locale_code[] NOT NULL DEFAULT '{fr}',
  timezone TEXT NOT NULL DEFAULT 'Europe/Brussels',
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}', -- seuils spécifiques pays, voir credit_rules
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_countries_upd BEFORE UPDATE ON countries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
INSERT INTO countries(code,name_i18n,currency_code,default_locale,locales,timezone) VALUES
  ('BE','{"fr":"Belgique","en":"Belgium","nl":"België","de":"Belgien"}'::jsonb,'EUR','fr','{fr,nl,de,en}','Europe/Brussels'),
  ('FR','{"fr":"France","en":"France","nl":"Frankrijk","de":"Frankreich"}'::jsonb,'EUR','fr','{fr,en}','Europe/Paris'),
  ('NL','{"fr":"Pays-Bas","en":"Netherlands","nl":"Nederland","de":"Niederlande"}'::jsonb,'EUR','nl','{nl,en}','Europe/Amsterdam'),
  ('DE','{"fr":"Allemagne","en":"Germany","nl":"Duitsland","de":"Deutschland"}'::jsonb,'EUR','de','{de,en}','Europe/Berlin'),
  ('LU','{"fr":"Luxembourg","en":"Luxembourg","nl":"Luxemburg","de":"Luxemburg"}'::jsonb,'EUR','fr','{fr,de,en}','Europe/Luxembourg')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS country_languages (
  country_code CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  language_code locale_code NOT NULL REFERENCES languages(code) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (country_code, language_code)
);
INSERT INTO country_languages(country_code,language_code,is_default) VALUES
  ('BE','fr',true),('BE','nl',false),('BE','de',false),('BE','en',false),
  ('FR','fr',true),('FR','en',false),('NL','nl',true),('NL','en',false),('DE','de',true),('DE','en',false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. IAM — users / roles / permissions / customers / administrators
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  locale locale_code NOT NULL DEFAULT 'fr',
  timezone TEXT NOT NULL DEFAULT 'Europe/Brussels',
  is_active BOOLEAN NOT NULL DEFAULT true,
  email_verified_at TIMESTAMPTZ,
  phone CITEXT,
  phone_verified_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_secret TEXT, -- pgp_sym_encrypt
  mfa_verified_at TIMESTAMPTZ,
  niss_hash TEXT, -- sha256 peppered
  niss_last4 CHAR(4),
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_email CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$')
);
CREATE UNIQUE INDEX uq_users_email_active ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_niss_hash ON users(niss_hash) WHERE niss_hash IS NOT NULL;
CREATE TRIGGER trg_users_upd BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL, -- CUSTOMER, ADMIN, SUPER_ADMIN, RISK_MANAGER, COMPLIANCE, SUPPORT
  name_i18n JSONB NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  country_code CHAR(2) REFERENCES countries(code), -- NULL = global
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code, country_code)
);
CREATE TRIGGER trg_roles_upd BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
INSERT INTO roles(code,name_i18n,is_system) VALUES
  ('CUSTOMER','{"fr":"Client","en":"Customer"}',true),
  ('ADMIN','{"fr":"Administrateur","en":"Administrator"}',true),
  ('SUPER_ADMIN','{"fr":"Super-administrateur","en":"Super Administrator"}',true),
  ('RISK_MANAGER','{"fr":"Risk Manager","en":"Risk Manager"}',false),
  ('COMPLIANCE','{"fr":"Conformité","en":"Compliance"}',false)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- credit:simulate, application:approve, rule:write, payment:refund, etc.
  name_i18n JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO permissions(code,name_i18n) VALUES
  ('credit.simulate','{"fr":"Simuler"}'),('application.create','{"fr":"Créer dossier"}'),('application.submit','{"fr":"Soumettre"}'),
  ('application.approve','{"fr":"Approuver"}'),('application.reject','{"fr":"Rejeter"}'),('application.approve_exception','{"fr":"Approuver avec exception"}'),
  ('rule.read','{"fr":"Lire règles"}'),('rule.write','{"fr":"Écrire règles"}'),('audit.read','{"fr":"Lire audit"}'),
  ('payment.create','{"fr":"Créer paiement"}'),('payment.refund','{"fr":"Rembourser"}'),('document.verify','{"fr":"Vérifier document"}'),
  ('kyc.verify','{"fr":"Vérifier KYC"}'),('investment.subscribe','{"fr":"Souscrire investissement"}')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);
-- Seed: ADMIN has all, CUSTOMER limited
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code='SUPER_ADMIN'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code='ADMIN' AND p.code IN ('credit.simulate','application.approve','application.reject','application.approve_exception','rule.read','rule.write','audit.read','payment.create','payment.refund','document.verify','kyc.verify')
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code='CUSTOMER' AND p.code IN ('credit.simulate','application.create','application.submit','payment.create','investment.subscribe')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- Customers — extension 1-1 de users (profil RGPD, données chiffrées)
CREATE TABLE IF NOT EXISTS customers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name_encrypted TEXT, -- pgp_sym_encrypt
  last_name_encrypted TEXT,
  dob_encrypted TEXT, -- date de naissance chiffrée
  nationality CHAR(2) REFERENCES countries(code),
  address_encrypted TEXT, -- JSON chiffré
  income_type TEXT CHECK (income_type IN ('SALARY','SELF_EMPLOYED','PENSION','OTHER','UNEMPLOYMENT')),
  employment_status TEXT CHECK (employment_status IN ('CDI','CDD','INDEPENDENT','INTERIM','RETIRED','STUDENT','UNEMPLOYED')),
  preferred_locale locale_code NOT NULL DEFAULT 'fr',
  preferred_currency currency_code NOT NULL DEFAULT 'EUR',
  kyc_status kyc_status NOT NULL DEFAULT 'NOT_STARTED',
  risk_level TEXT CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_customers_kyc ON customers(kyc_status);
CREATE TRIGGER trg_customers_upd BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Administrators — extension 1-1 de users
CREATE TABLE IF NOT EXISTS administrators (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employee_id TEXT UNIQUE,
  department TEXT,
  is_super BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE TRIGGER trg_admins_upd BEFORE UPDATE ON administrators FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. CRÉDIT — Produits / Règles / Grilles de taux (versionnés, non hardcodés)
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL, -- PERSONAL_BE, MORTGAGE_BE, etc. unique par version active
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  type credit_product_type NOT NULL,
  name_i18n JSONB NOT NULL,
  description_i18n JSONB,
  currency_code currency_code NOT NULL DEFAULT 'EUR',
  min_amount NUMERIC(15,2) NOT NULL CHECK (min_amount > 0),
  max_amount NUMERIC(15,2) NOT NULL CHECK (max_amount >= min_amount),
  min_term INT NOT NULL CHECK (min_term >= 1),
  max_term INT NOT NULL CHECK (max_term >= min_term),
  status credit_product_status NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}', -- seuils spécifiques produit si besoin
  needs_legal_validation BOOLEAN NOT NULL DEFAULT true,
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_product_dates CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE(code, version)
);
CREATE INDEX idx_credit_products_country_type ON credit_products(country_code, type) WHERE deleted_at IS NULL AND status='ACTIVE';
CREATE INDEX idx_credit_products_code ON credit_products(code);
CREATE TRIGGER trg_credit_products_upd BEFORE UPDATE ON credit_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Règles financières configurables (ex: max_debt_ratio, min_age, scoring_weights)
CREATE TABLE IF NOT EXISTS credit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL, -- max_debt_ratio, min_age, max_age, min_income, scoring_weights, required_docs_PERSONAL ...
  value JSONB NOT NULL, -- 0.33, {"debtRatio":35,...}, ["ID",...]
  country_code CHAR(2) REFERENCES countries(code), -- NULL = global
  product_type credit_product_type, -- NULL = tous produits
  category rule_category NOT NULL,
  is_hard BOOLEAN NOT NULL DEFAULT false, -- hard → REJECT, soft → REVIEW
  needs_legal_validation BOOLEAN NOT NULL DEFAULT true,
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  status rule_status NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_rule_dates CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE(key, country_code, product_type, version)
);
CREATE INDEX idx_credit_rules_key ON credit_rules(key, country_code, product_type) WHERE status='ACTIVE';
CREATE INDEX idx_credit_rules_active ON credit_rules(status, effective_from) WHERE status='ACTIVE';
CREATE TRIGGER trg_credit_rules_upd BEFORE UPDATE ON credit_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS credit_rate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES credit_products(id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  product_type credit_product_type NOT NULL,
  min_amount NUMERIC(15,2) NOT NULL,
  max_amount NUMERIC(15,2) NOT NULL,
  min_term INT NOT NULL,
  max_term INT NOT NULL,
  base_rate NUMERIC(6,5) NOT NULL CHECK (base_rate >= 0 AND base_rate < 1), -- 0.0499 = 4.99%
  fees JSONB NOT NULL DEFAULT '{}', -- {"filePct":0.01,"fileMin":75,"fileMax":400,"insurancePct":0}
  status rate_rule_status NOT NULL DEFAULT 'ACTIVE',
  version INT NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_rate_dates CHECK (effective_until IS NULL OR effective_until > effective_from),
  CONSTRAINT chk_rate_amount CHECK (max_amount >= min_amount),
  CONSTRAINT chk_rate_term CHECK (max_term >= min_term),
  UNIQUE(product_id, min_amount, max_amount, min_term, max_term, version)
);
CREATE INDEX idx_rate_rules_lookup ON credit_rate_rules(country_code, product_type, min_amount, max_amount, min_term, max_term) WHERE status='ACTIVE' AND effective_until IS NULL;
CREATE TRIGGER trg_rate_rules_upd BEFORE UPDATE ON credit_rate_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. SIMULATIONS (immutables, RGPD: anonymisables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL si anonyme
  product_id UUID REFERENCES credit_products(id) ON DELETE SET NULL,
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  product_type credit_product_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  term_months INT NOT NULL CHECK (term_months > 0),
  input_snapshot JSONB NOT NULL, -- {monthlyIncome, monthlyCharges, ...}
  output_snapshot JSONB NOT NULL, -- {monthlyPayment, taeg, schedule, fees, disclaimer}
  rate_rule_id UUID REFERENCES credit_rate_rules(id),
  monthly_payment NUMERIC(15,2) NOT NULL,
  taeg NUMERIC(6,5) NOT NULL,
  total_cost NUMERIC(15,2) NOT NULL,
  ip INET,
  user_agent TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_simulations_customer ON credit_simulations(customer_id, created_at DESC);
CREATE INDEX idx_simulations_country ON credit_simulations(country_code, product_type);

-- ============================================================================
-- 6. DEMANDES DE CRÉDIT
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES credit_products(id) ON DELETE RESTRICT,
  simulation_id UUID REFERENCES credit_simulations(id) ON DELETE SET NULL,
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  term_months INT NOT NULL CHECK (term_months > 0),
  purpose TEXT,
  status application_status NOT NULL DEFAULT 'DRAFT',
  current_step SMALLINT NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 10),
  simulation_snapshot JSONB, -- figé à la soumission
  eligibility_snapshot JSONB,
  scoring_snapshot JSONB,
  recommendation recommendation, -- pré-décision moteur
  contract_ref TEXT,
  psp_ref TEXT,
  idempotency_key TEXT, -- double soumission: X-Idempotency-Key
  version INT NOT NULL DEFAULT 1, -- optimistic locking If-Match
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_application_idempotency UNIQUE (customer_id, idempotency_key) -- NULLS NOT DISTINCT en PG15: on ajoute where
);
-- PG15+: UNIQUE NULLS NOT DISTINCT serait mieux; on force partial
CREATE UNIQUE INDEX uq_app_idempotency ON credit_applications(customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_applications_customer ON credit_applications(customer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_status ON credit_applications(status, country_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_applications_product ON credit_applications(product_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_applications_upd BEFORE UPDATE ON credit_applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS credit_application_status_history (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES credit_applications(id) ON DELETE CASCADE,
  from_status application_status NOT NULL,
  to_status application_status NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type actor_type NOT NULL,
  actor_role TEXT NOT NULL, -- snapshot rôle au moment
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hist_app ON credit_application_status_history(application_id, created_at DESC);
CREATE INDEX idx_hist_actor ON credit_application_status_history(actor_id, created_at DESC);
CREATE INDEX idx_hist_correlation ON credit_application_status_history(correlation_id);

-- ============================================================================
-- 7. SCORING & DÉCISIONS (historique complet, exceptions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES credit_applications(id) ON DELETE CASCADE,
  score_value SMALLINT NOT NULL CHECK (score_value BETWEEN 0 AND 100),
  grade score_grade NOT NULL,
  breakdown JSONB NOT NULL, -- {debtRatio:35, incomeStability:20,...}
  explanation TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'v1',
  inputs_snapshot JSONB NOT NULL, -- pour reproductibilité
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scores_grade ON credit_scores(grade);

CREATE TABLE IF NOT EXISTS credit_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES credit_applications(id) ON DELETE CASCADE,
  recommendation recommendation NOT NULL,
  final_decision final_decision NOT NULL DEFAULT 'PENDING',
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL, -- ADMIN/SUPER_ADMIN
  decided_at TIMESTAMPTZ,
  reason TEXT,
  conditions JSONB NOT NULL DEFAULT '[]', -- ["apport 10k", "garantie"]
  is_exception BOOLEAN NOT NULL DEFAULT false,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decisions_final ON credit_decisions(final_decision);
CREATE INDEX idx_decisions_decided_by ON credit_decisions(decided_by);
CREATE TRIGGER trg_decisions_upd BEFORE UPDATE ON credit_decisions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Exceptions ADMIN : conserve règle violée, valeur observée, motif, admin, date, conditions, validation
CREATE TABLE IF NOT EXISTS credit_decision_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID NOT NULL REFERENCES credit_decisions(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES credit_applications(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES credit_rules(id) ON DELETE SET NULL, -- règle non respectée (nullable si hors catalogue)
  rule_key TEXT NOT NULL, -- snapshot clé même si règle supprimée
  rule_value JSONB NOT NULL, -- seuil configuré snapshot
  observed_value JSONB NOT NULL, -- valeur constatée (ex: debtRatio 0.48)
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 20 AND 2000), -- motif 20-2000
  conditions JSONB NOT NULL DEFAULT '[]', -- conditions éventuelles
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VALIDATED','REJECTED')),
  created_by UUID NOT NULL REFERENCES users(id), -- administrateur
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exceptions_decision ON credit_decision_exceptions(decision_id);
CREATE INDEX idx_exceptions_rule ON credit_decision_exceptions(rule_key);
CREATE TRIGGER trg_exceptions_upd BEFORE UPDATE ON credit_decision_exceptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Historique décisions (append-only pour audit fin)
CREATE TABLE IF NOT EXISTS credit_decision_history (
  id BIGSERIAL PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES credit_decisions(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES credit_applications(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- created, updated, exception_added, validated
  payload JSONB NOT NULL,
  actor_id UUID REFERENCES users(id),
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decision_hist_decision ON credit_decision_history(decision_id, created_at DESC);

-- ============================================================================
-- 8. PRÊTS & ÉCHÉANCES & PAIEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID UNIQUE REFERENCES credit_applications(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES credit_products(id),
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  principal NUMERIC(15,2) NOT NULL CHECK (principal > 0),
  taeg NUMERIC(6,5) NOT NULL CHECK (taeg >= 0),
  term_months INT NOT NULL CHECK (term_months > 0),
  monthly_amount NUMERIC(15,2) NOT NULL CHECK (monthly_amount > 0),
  fees JSONB NOT NULL DEFAULT '{}',
  currency_code currency_code NOT NULL DEFAULT 'EUR',
  status loan_status NOT NULL DEFAULT 'DRAFT',
  disbursed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_loans_customer ON loans(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_loans_status ON loans(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_loans_application ON loans(application_id);
CREATE TRIGGER trg_loans_upd BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS loan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  number SMALLINT NOT NULL CHECK (number >= 1),
  due_date DATE NOT NULL, -- 10 du mois, Europe/Brussels
  principal_due NUMERIC(15,2) NOT NULL CHECK (principal_due >= 0),
  interest_due NUMERIC(15,2) NOT NULL CHECK (interest_due >= 0),
  fees_due NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_due NUMERIC(15,2) NOT NULL CHECK (total_due >= 0),
  principal_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  interest_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  fees_paid NUMERIC(15,2) NOT NULL DEFAULT 0,
  status installment_status NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(loan_id, number)
);
CREATE INDEX idx_installments_loan ON loan_installments(loan_id);
CREATE INDEX idx_installments_due ON loan_installments(due_date) WHERE status IN ('DUE','OVERDUE','PENDING');
CREATE TRIGGER trg_installments_upd BEFORE UPDATE ON loan_installments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Paiements (loan_payments) — idempotence + jamais SUCCEEDED sans webhook/confirm
CREATE TABLE IF NOT EXISTS loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type payment_type NOT NULL DEFAULT 'INSTALLMENT',
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency_code currency_code NOT NULL DEFAULT 'EUR',
  installment_ids UUID[] NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  status payment_status NOT NULL DEFAULT 'PENDING',
  provider TEXT NOT NULL DEFAULT 'mollie', -- mollie/stripe/admin-confirm
  provider_payment_id TEXT,
  receipt_url TEXT,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_loan_payments_idemp ON loan_payments(idempotency_key);
CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id, created_at DESC);
CREATE INDEX idx_loan_payments_provider ON loan_payments(provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX idx_loan_payments_status ON loan_payments(status);
CREATE TRIGGER trg_loan_payments_upd BEFORE UPDATE ON loan_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES loan_payments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  type transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  status transaction_status NOT NULL DEFAULT 'CREATED',
  raw_payload JSONB,
  signature_valid BOOLEAN NOT NULL DEFAULT true,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_payment ON payment_transactions(payment_id, created_at DESC);
CREATE INDEX idx_tx_provider ON payment_transactions(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

-- ============================================================================
-- 9. INVESTISSEMENTS — générique multi-types, restrictions pays/type
-- ============================================================================
CREATE TABLE IF NOT EXISTS investment_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL, -- BOND_BE_2026_001
  name_i18n JSONB NOT NULL,
  description_i18n JSONB,
  type investment_product_type NOT NULL,
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  currency_code currency_code NOT NULL DEFAULT 'EUR',
  min_amount NUMERIC(15,2) NOT NULL CHECK (min_amount > 0),
  max_amount NUMERIC(15,2) CHECK (max_amount IS NULL OR max_amount >= min_amount),
  term_months INT CHECK (term_months IS NULL OR term_months > 0),
  yield_method TEXT NOT NULL DEFAULT 'FIXED' CHECK (yield_method IN ('FIXED','VARIABLE','FORMULA')),
  yield_config JSONB NOT NULL DEFAULT '{}',
  risk_level SMALLINT NOT NULL CHECK (risk_level BETWEEN 1 AND 7),
  risk_factors JSONB NOT NULL DEFAULT '[]',
  capital_guaranteed BOOLEAN NOT NULL DEFAULT false,
  guarantee_details JSONB,
  status investment_product_status NOT NULL DEFAULT 'DRAFT',
  version INT NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  total_subscribed NUMERIC(15,2) NOT NULL DEFAULT 0,
  max_total NUMERIC(15,2),
  available_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  available_to TIMESTAMPTZ,
  documents JSONB NOT NULL DEFAULT '[]',
  config JSONB NOT NULL DEFAULT '{}',
  needs_legal_validation BOOLEAN NOT NULL DEFAULT true,
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_inv_dates CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE(code, version)
);
CREATE INDEX idx_inv_products_country ON investment_products(country_code, type) WHERE deleted_at IS NULL AND status='ACTIVE';
CREATE INDEX idx_inv_products_status ON investment_products(status);
CREATE TRIGGER trg_inv_products_upd BEFORE UPDATE ON investment_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS investment_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  investor_type investor_type NOT NULL,
  product_type investment_product_type NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  min_amount NUMERIC(15,2),
  max_amount NUMERIC(15,2),
  requires_accreditation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_code, investor_type, product_type)
);

CREATE TABLE IF NOT EXISTS investor_profiles (
  customer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  type investor_type NOT NULL DEFAULT 'RETAIL',
  risk_tolerance SMALLINT NOT NULL DEFAULT 3 CHECK (risk_tolerance BETWEEN 1 AND 7),
  suitability_score SMALLINT CHECK (suitability_score BETWEEN 0 AND 100),
  suitability_answers JSONB,
  accreditation_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_investor_profiles_upd BEFORE UPDATE ON investor_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES investment_products(id) ON DELETE RESTRICT,
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency_code currency_code NOT NULL DEFAULT 'EUR',
  status investment_status NOT NULL DEFAULT 'PENDING',
  idempotency_key TEXT NOT NULL,
  suitability_snapshot JSONB,
  subscribed_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_investments_idemp ON investments(idempotency_key);
CREATE INDEX idx_investments_customer ON investments(customer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_investments_product ON investments(product_id);
CREATE TRIGGER trg_investments_upd BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  type investment_transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  status investment_transaction_status NOT NULL DEFAULT 'PENDING',
  provider_ref TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_tx_investment ON investment_transactions(investment_id, created_at DESC);

-- ============================================================================
-- 10. KYC
-- ============================================================================
CREATE TABLE IF NOT EXISTS kyc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status kyc_status NOT NULL DEFAULT 'NOT_STARTED',
  identity_data_encrypted TEXT, -- pgp_sym_encrypt(JSON {firstName,lastName,dob,nationality})
  address_data_encrypted TEXT,
  phone CITEXT,
  phone_verified_at TIMESTAMPTZ,
  email CITEXT,
  email_verified_at TIMESTAMPTZ,
  documents JSONB NOT NULL DEFAULT '[]',
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kyc_status ON kyc_profiles(status);
CREATE TRIGGER trg_kyc_upd BEFORE UPDATE ON kyc_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS kyc_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_profile_id UUID NOT NULL REFERENCES kyc_profiles(id) ON DELETE CASCADE,
  type kyc_check_type NOT NULL,
  provider TEXT NOT NULL DEFAULT 'admin-manual', -- admin-manual, mock-aml, basic-fraud
  status kyc_check_status NOT NULL DEFAULT 'PENDING',
  result JSONB NOT NULL DEFAULT '{}',
  risk_level TEXT CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
  checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kyc_checks_profile ON kyc_checks(kyc_profile_id, created_at DESC);
CREATE INDEX idx_kyc_checks_type ON kyc_checks(type, status);

-- ============================================================================
-- 11. DOCUMENTS (S3/Minio, ClamAV, SSE-KMS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  application_id UUID REFERENCES credit_applications(id) ON DELETE SET NULL,
  investment_id UUID REFERENCES investments(id) ON DELETE SET NULL,
  kyc_profile_id UUID REFERENCES kyc_profiles(id) ON DELETE SET NULL,
  type document_type NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes INT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- 10 MB
  s3_key TEXT NOT NULL UNIQUE, -- kredit-docs/{customer_id}/{doc_id}
  s3_bucket TEXT NOT NULL DEFAULT 'kredit-docs',
  sha256 TEXT NOT NULL,
  scan_status scan_status NOT NULL DEFAULT 'PENDING',
  status document_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ, -- pièce d'identité
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_docs_customer ON documents(customer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_application ON documents(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX idx_docs_type_status ON documents(type, status);
CREATE INDEX idx_docs_sha256 ON documents(sha256);
CREATE TRIGGER trg_docs_upd BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS credit_application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES credit_applications(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  required_code TEXT NOT NULL, -- ID, BANK_STATEMENTS_3M ...
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(application_id, document_id)
);
CREATE INDEX idx_app_docs_app ON credit_application_documents(application_id);

-- ============================================================================
-- 12. NOTIFICATIONS — templates i18n + outbox + logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL CHECK (event IN ('ACCOUNT_CREATED','OTP_REQUESTED','APPLICATION_STARTED','APPLICATION_SUBMITTED','DOCUMENT_REQUIRED','APPLICATION_UNDER_REVIEW','APPLICATION_APPROVED','APPLICATION_APPROVED_EXCEPTION','APPLICATION_REJECTED','CONTRACT_READY','PAYMENT_RECEIVED','PAYMENT_DUE','PAYMENT_OVERDUE','KYC_VERIFIED','KYC_REJECTED')),
  channel notif_channel NOT NULL,
  locale locale_code NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  whatsapp_hsm_id TEXT,
  whatsapp_template_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event, channel, locale, version)
);
CREATE INDEX idx_tpl_active ON notification_templates(event, channel, locale) WHERE is_active;
CREATE TRIGGER trg_templates_upd BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  event TEXT NOT NULL,
  channel notif_channel NOT NULL,
  locale locale_code NOT NULL,
  recipient TEXT NOT NULL, -- email/phone/endpoint
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  payload JSONB NOT NULL, -- {name, amount, ...} RGPD redacted
  status notif_status NOT NULL DEFAULT 'PENDING',
  attempts SMALLINT NOT NULL DEFAULT 0,
  last_error TEXT,
  provider_ref TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_notifications_idemp ON notifications(idempotency_key);
CREATE INDEX idx_notifications_status ON notifications(status, channel, created_at);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_user_id, created_at DESC);
CREATE TRIGGER trg_notifications_upd BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGSERIAL PRIMARY KEY,
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel notif_channel NOT NULL,
  status notif_status NOT NULL,
  provider TEXT,
  provider_ref TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_logs_notification ON notification_logs(notification_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_preferences (
  customer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale locale_code NOT NULL DEFAULT 'fr',
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  preferences JSONB NOT NULL DEFAULT '{}',
  consent_whatsapp_at TIMESTAMPTZ,
  consent_sms_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_notif_prefs_upd BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);
CREATE INDEX idx_push_customer ON push_subscriptions(customer_id);

-- ============================================================================
-- 13. AUDIT & SÉCURITÉ — append-only, hash chaîné, immuable
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL, -- email ou 'system' ou 'anonymous:IP'
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type actor_type NOT NULL,
  action TEXT NOT NULL, -- entity_type:action (voir EntityType+AuditAction)
  entity_type entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  ip INET,
  user_agent TEXT,
  correlation_id TEXT NOT NULL,
  before JSONB, -- diff avant (redacted)
  after JSONB,  -- diff après
  reason TEXT,
  hash TEXT NOT NULL, -- sha256(prev_hash || payload)
  prev_hash TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, timestamp DESC);
CREATE INDEX idx_audit_correlation ON audit_logs(correlation_id);
CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);

-- Trigger immutabilité
CREATE OR REPLACE FUNCTION audit_no_update_delete() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append-only — UPDATE/DELETE forbidden (hash chain)'; RETURN NULL; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_logs;
CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_no_update_delete();

CREATE TABLE IF NOT EXISTS security_logs (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type actor_type,
  event_type security_event_type NOT NULL,
  entity_type entity_type,
  entity_id TEXT,
  ip INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO','WARN','CRITICAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sec_event ON security_logs(event_type, created_at DESC);
CREATE INDEX idx_sec_ip ON security_logs(ip, created_at DESC);
CREATE INDEX idx_sec_correlation ON security_logs(correlation_id);
CREATE INDEX idx_sec_severity ON security_logs(severity, created_at DESC) WHERE severity='CRITICAL';
DROP TRIGGER IF EXISTS trg_sec_immutable ON security_logs;
CREATE TRIGGER trg_sec_immutable BEFORE UPDATE OR DELETE ON security_logs FOR EACH ROW EXECUTE FUNCTION audit_no_update_delete();

-- Tables annexes sécurité (rate limit, backups déjà en 007)
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_seconds INT NOT NULL DEFAULT 60,
  count INT NOT NULL DEFAULT 1,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(key, window_start)
);
CREATE INDEX idx_rl_key ON rate_limit_counters(key, window_start DESC);

CREATE TABLE IF NOT EXISTS backup_jobs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('PG_BASE','PG_WAL','S3_DOCS','REDIS_RDB')),
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','FAILED','RUNNING')),
  location TEXT NOT NULL,
  size_bytes BIGINT,
  checksum TEXT,
  encrypted BOOLEAN NOT NULL DEFAULT true,
  pitr_target TIMESTAMPTZ,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vue investigation unifiée
CREATE OR REPLACE VIEW v_investigation AS
  SELECT 'AUDIT'::text AS source, id, actor, actor_type::text, action AS event, entity_type::text, entity_id, ip, user_agent, correlation_id, timestamp, reason, before, after FROM audit_logs
  UNION ALL
  SELECT 'SECURITY'::text, id, actor, actor_type::text, event_type::text, entity_type::text, entity_id, ip, user_agent, correlation_id, created_at AS timestamp, null AS reason, metadata AS before, null AS after FROM security_logs;

-- ============================================================================
-- 14. FONCTIONS & INDEXES COMPLÉMENTAIRES
-- ============================================================================
-- Recherche insensible à la casse sur applications contrat
CREATE INDEX IF NOT EXISTS idx_apps_contract ON credit_applications(contract_ref) WHERE contract_ref IS NOT NULL;
-- Recherche documents par hash pour déduplication
-- GIN sur payload notifications pour analyse
CREATE INDEX IF NOT EXISTS idx_notifications_payload_gin ON notifications USING GIN (payload);
-- Partial index pour KYC expirés à nettoyer
CREATE INDEX IF NOT EXISTS idx_kyc_expires ON kyc_profiles(expires_at) WHERE status='VERIFIED' AND expires_at IS NOT NULL;

-- ============================================================================
-- 15. DONNÉES DE RÉFÉRENCE MINIMALES (BE)
-- ============================================================================
-- Déjà seedé ci-dessus (currencies, languages, countries, roles, permissions).
-- Crédit : produits BE (PERSONAL/MORTGAGE/BUSINESS) à insérer via seeds.
