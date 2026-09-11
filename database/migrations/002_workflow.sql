-- 002_workflow: credit_application_status_history + application_status enum étendu
CREATE TYPE application_status AS ENUM (
  'DRAFT','SUBMITTED','KYC_PENDING','DOCUMENTS_PENDING',
  'UNDER_AUTOMATED_REVIEW','UNDER_ADMIN_REVIEW','MORE_INFORMATION_REQUIRED',
  'APPROVED','APPROVED_WITH_EXCEPTION','REJECTED',
  'CONTRACT_PENDING','CONTRACT_SIGNED','DISBURSEMENT_PENDING','DISBURSED','CLOSED','CANCELLED'
);
CREATE TABLE IF NOT EXISTS credit_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  country CHAR(2) NOT NULL DEFAULT 'BE',
  amount NUMERIC(15,2) NOT NULL,
  term_months INT NOT NULL,
  status application_status NOT NULL DEFAULT 'DRAFT',
  current_step INT DEFAULT 1,
  simulation_snapshot JSONB,
  eligibility_snapshot JSONB,
  scoring_snapshot JSONB,
  recommendation TEXT,
  exception_reason TEXT,
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  contract_ref TEXT,
  psp_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS credit_application_status_history (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES credit_applications(id),
  from_status application_status NOT NULL,
  to_status application_status NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_role TEXT NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hist_app ON credit_application_status_history(application_id, created_at);
-- audit_logs déjà créé en 001
