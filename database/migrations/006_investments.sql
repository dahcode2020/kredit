-- 006_investments.sql — Module investissement générique

CREATE TYPE investment_product_type AS ENUM ('BOND','FUND','TERM_DEPOSIT','SAVINGS','EQUITY');
CREATE TYPE investment_product_status AS ENUM ('DRAFT','ACTIVE','SUSPENDED','CLOSED');
CREATE TYPE investor_type AS ENUM ('RETAIL','PROFESSIONAL','ELIGIBLE_COUNTERPARTY');
CREATE TYPE investment_transaction_type AS ENUM ('SUBSCRIBED','DIVIDEND','REDEMPTION','FEES','REFUND');
CREATE TYPE investment_transaction_status AS ENUM ('PENDING','SUCCEEDED','FAILED','CANCELLED');

CREATE TABLE IF NOT EXISTS investment_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name_i18n JSONB NOT NULL,
  description_i18n JSONB,
  type investment_product_type NOT NULL,
  country_code CHAR(2) REFERENCES countries(code) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  min_amount NUMERIC(15,2) NOT NULL,
  max_amount NUMERIC(15,2),
  term_months INT,
  yield_method TEXT NOT NULL DEFAULT 'FIXED' CHECK (yield_method IN ('FIXED','VARIABLE','FORMULA')),
  yield_config JSONB NOT NULL DEFAULT '{}',
  risk_level INT NOT NULL CHECK (risk_level BETWEEN 1 AND 7),
  risk_factors JSONB DEFAULT '[]',
  capital_guaranteed BOOLEAN DEFAULT false,
  guarantee_details JSONB,
  status investment_product_status NOT NULL DEFAULT 'DRAFT',
  total_subscribed NUMERIC(15,2) DEFAULT 0,
  max_total NUMERIC(15,2),
  available_from TIMESTAMPTZ DEFAULT now(),
  available_to TIMESTAMPTZ,
  documents JSONB DEFAULT '[]',
  config JSONB DEFAULT '{}',
  needs_legal_validation BOOLEAN DEFAULT true,
  validated_by_legal_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invest_products_country ON investment_products(country_code);
CREATE INDEX IF NOT EXISTS idx_invest_products_status ON investment_products(status);
CREATE INDEX IF NOT EXISTS idx_invest_products_type ON investment_products(type);

CREATE TABLE IF NOT EXISTS investor_profiles (
  customer_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  type investor_type NOT NULL DEFAULT 'RETAIL',
  risk_tolerance INT NOT NULL DEFAULT 3 CHECK (risk_tolerance BETWEEN 1 AND 7),
  suitability_score INT,
  suitability_answers JSONB,
  accreditation_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investment_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) REFERENCES countries(code) NOT NULL,
  investor_type investor_type NOT NULL,
  product_type investment_product_type NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  min_amount NUMERIC(15,2),
  max_amount NUMERIC(15,2),
  requires_accreditation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, investor_type, product_type)
);

CREATE TABLE IF NOT EXISTS investment_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) NOT NULL,
  product_id UUID REFERENCES investment_products(id) NOT NULL,
  amount_subscribed NUMERIC(15,2) NOT NULL,
  amount_current NUMERIC(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REDEEMED','CANCELLED')),
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  documents_ack BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_positions_customer ON investment_positions(customer_id);
CREATE INDEX IF NOT EXISTS idx_positions_product ON investment_positions(product_id);

CREATE TABLE IF NOT EXISTS investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID REFERENCES investment_positions(id) ON DELETE CASCADE NOT NULL,
  type investment_transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  status investment_transaction_status NOT NULL DEFAULT 'PENDING',
  provider_payment_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_tx_position ON investment_transactions(position_id);

-- Seed restrictions BE
INSERT INTO investment_restrictions (country_code, investor_type, product_type, allowed, max_amount, requires_accreditation) VALUES
('BE','RETAIL','BOND', true, 100000, false),
('BE','RETAIL','FUND', true, 50000, false),
('BE','RETAIL','EQUITY', false, null, true),
('BE','PROFESSIONAL','EQUITY', true, null, false)
ON CONFLICT DO NOTHING;

-- Seed produits BE exemples
INSERT INTO investment_products (code, name_i18n, description_i18n, type, country_code, currency, min_amount, max_amount, term_months, yield_method, yield_config, risk_level, capital_guaranteed, status, max_total, validated_by_legal_at) VALUES
('BE_GREEN_BOND_2031', '{"fr":"Obligation verte BE 2031","en":"BE Green Bond 2031","nl":"BE Groene Obligatie 2031","de":"BE Grüne Anleihe 2031"}', '{"fr":"Obligation État belge verte, 5 ans"}', 'BOND', 'BE', 'EUR', 5000, 100000, 60, 'FIXED', '{"fixed_rate":0.021}', 3, false, 'ACTIVE', 5000000, now()),
('BE_TERM_DEPOSIT_12M', '{"fr":"Dépôt à terme 12M","en":"Term Deposit 12M"}', '{"fr":"Dépôt garanti"}', 'TERM_DEPOSIT', 'BE', 'EUR', 1000, 100000, 12, 'FIXED', '{"fixed_rate":0.015}', 1, true, 'ACTIVE', 10000000, now())
ON CONFLICT DO NOTHING;
