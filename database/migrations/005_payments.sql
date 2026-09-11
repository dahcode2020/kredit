-- 005_payments.sql — Module paiement indépendant fournisseur

CREATE TYPE loan_status AS ENUM ('DRAFT','ACTIVE','REPAID','DEFAULTED','CLOSED');
CREATE TYPE installment_status AS ENUM ('PENDING','DUE','PARTIALLY_PAID','PAID','OVERDUE','WAIVED');
CREATE TYPE payment_type AS ENUM ('INSTALLMENT','EARLY_REPAYMENT','FEES','REFUND');
CREATE TYPE payment_status AS ENUM ('PENDING','PROCESSING','SUCCEEDED','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED');
CREATE TYPE transaction_type AS ENUM ('AUTHORIZATION','CAPTURE','REFUND','CHARGEBACK');
CREATE TYPE transaction_status AS ENUM ('CREATED','AUTHORIZED','CAPTURED','FAILED','REFUNDED');

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES applications(id),
  customer_id UUID REFERENCES users(id) NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mollie',
  principal NUMERIC(15,2) NOT NULL,
  taeg NUMERIC(5,4) NOT NULL,
  term_months INT NOT NULL,
  monthly_amount NUMERIC(15,2) NOT NULL,
  fees JSONB DEFAULT '{}',
  status loan_status NOT NULL DEFAULT 'DRAFT',
  disbursed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loans_customer ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

CREATE TABLE IF NOT EXISTS loan_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
  number INT NOT NULL,
  due_date DATE NOT NULL,
  principal_due NUMERIC(15,2) NOT NULL,
  interest_due NUMERIC(15,2) NOT NULL,
  fees_due NUMERIC(15,2) DEFAULT 0,
  total_due NUMERIC(15,2) NOT NULL,
  principal_paid NUMERIC(15,2) DEFAULT 0,
  interest_paid NUMERIC(15,2) DEFAULT 0,
  fees_paid NUMERIC(15,2) DEFAULT 0,
  status installment_status NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(loan_id, number)
);
CREATE INDEX IF NOT EXISTS idx_installments_loan ON loan_installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_installments_due ON loan_installments(due_date) WHERE status IN ('DUE','OVERDUE');

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES loans(id) NOT NULL,
  customer_id UUID REFERENCES users(id) NOT NULL,
  type payment_type NOT NULL DEFAULT 'INSTALLMENT',
  amount NUMERIC(15,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  installment_ids UUID[] DEFAULT '{}',
  idempotency_key TEXT UNIQUE NOT NULL,
  status payment_status NOT NULL DEFAULT 'PENDING',
  provider TEXT NOT NULL DEFAULT 'mollie',
  provider_payment_id TEXT,
  receipt_url TEXT,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_idemp ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider_payment_id);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  type transaction_type NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  status transaction_status NOT NULL DEFAULT 'CREATED',
  raw_payload JSONB,
  signature_valid BOOLEAN DEFAULT true,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_payment ON payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_tx_provider ON payment_transactions(provider_transaction_id);

-- Idempotency + audit déjà via audit_logs
