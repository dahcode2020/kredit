# KREDIT — Schéma PostgreSQL (extrait product-ready)
> Voir `docs/architecture.md §4` pour principes. Ce fichier est la référence migrations.

```sql
-- Enable
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('CUSTOMER','ADMIN','SUPER_ADMIN');
CREATE TYPE kyc_status AS ENUM ('NOT_STARTED','IN_REVIEW','VERIFIED','REJECTED','EXPIRED');
CREATE TYPE app_status AS ENUM ('DRAFT','SUBMITTED','KYC_PENDING','SCORING','PENDING_REVIEW','MORE_INFO_REQUESTED','DECIDED_APPROVED','DECIDED_REJECTED','DECIDED_CONDITIONAL','PENDING_SUPER_REVIEW','DISBURSED','REPAID','DEFAULTED');
CREATE TYPE product_type AS ENUM ('PERSONAL','MORTGAGE','BUSINESS','INVESTMENT');

-- Countries (multi-tenant)
CREATE TABLE countries (
  code CHAR(2) PRIMARY KEY,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  locales TEXT[] NOT NULL,
  name_i18n JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO countries(code, currency, locales, name_i18n) VALUES ('BE','EUR','{fr,nl,de}','{"fr":"Belgique","en":"Belgium","nl":"België","de":"Belgien"}');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  locale TEXT NOT NULL DEFAULT 'fr',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
);

-- Products versioned
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code CHAR(2) REFERENCES countries(code),
  type product_type NOT NULL,
  name_i18n JSONB NOT NULL,
  description_i18n JSONB,
  min_amount NUMERIC(15,2) NOT NULL, max_amount NUMERIC(15,2) NOT NULL,
  min_term INT NOT NULL, max_term INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  effective_from TIMESTAMPTZ DEFAULT now(),
  effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);
CREATE TABLE product_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  min_taeg NUMERIC(5,4) NOT NULL, max_taeg NUMERIC(5,4) NOT NULL, base_rate NUMERIC(5,4),
  effective_from TIMESTAMPTZ DEFAULT now(), effective_to TIMESTAMPTZ,
  created_by UUID REFERENCES users(id)
);
CREATE TABLE product_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  rule_key TEXT NOT NULL, rule_value JSONB NOT NULL,
  is_hard_rule BOOLEAN DEFAULT false,
  needs_legal_validation BOOLEAN DEFAULT true,
  validated_by_legal_at TIMESTAMPTZ,
  effective_from TIMESTAMPTZ DEFAULT now()
);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  country_code CHAR(2) REFERENCES countries(code),
  amount NUMERIC(15,2) NOT NULL, term_months INT NOT NULL,
  purpose TEXT,
  status app_status NOT NULL DEFAULT 'DRAFT',
  scoring_snapshot JSONB, decision_snapshot JSONB,
  exception_reason TEXT, decided_by UUID REFERENCES users(id), decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_apps_status ON applications(status);
CREATE INDEX idx_apps_customer ON applications(customer_id);

-- Audit hash-chained
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  before JSONB, after JSONB, reason TEXT,
  hash TEXT NOT NULL, prev_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
-- no UPDATE/DELETE grants in prod — INSERT only via dedicated role
```

Principes: numeric pas float, jsonb i18n, RLS optionnelle par country_code, soft delete.
```
