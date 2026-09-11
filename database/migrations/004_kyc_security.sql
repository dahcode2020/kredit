-- 004_kyc_security.sql — KYC basique validé par ADMIN/SUPER_ADMIN + sécurité

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE kyc_status AS ENUM ('NOT_STARTED','IN_REVIEW','VERIFIED','REJECTED','EXPIRED');

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  status kyc_status NOT NULL DEFAULT 'NOT_STARTED',
  identity_data TEXT, -- pgp_sym_encrypt(JSON) — {firstName,lastName,dob,niss_hash,niss_last4,nationality}
  address_data TEXT, -- pgp_sym_encrypt(JSON)
  phone TEXT,
  phone_verified_at TIMESTAMPTZ,
  email TEXT,
  email_verified_at TIMESTAMPTZ,
  documents JSONB DEFAULT '[]',
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyc_customer ON kyc_verifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_verifications(status);

CREATE TABLE IF NOT EXISTS compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_verification_id UUID REFERENCES kyc_verifications(id) ON DELETE CASCADE,
  aml_status TEXT NOT NULL DEFAULT 'CLEAR' CHECK (aml_status IN ('CLEAR','REVIEW','HIT')),
  sanctions_checked_at TIMESTAMPTZ,
  sanctions_hit BOOLEAN DEFAULT false,
  fraud_status TEXT NOT NULL DEFAULT 'CLEAR' CHECK (fraud_status IN ('CLEAR','REVIEW','BLOCKED')),
  fraud_reasons JSONB DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
  blocked BOOLEAN DEFAULT false,
  checked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fraud_checks (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID REFERENCES users(id),
  check_type TEXT NOT NULL, -- VELOCITY, DUPLICATE_DOC, DISPOSABLE_EMAIL, NISS_DUPLICATE
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fraud_customer ON fraud_checks(customer_id);

-- Rate limiting / brute force (Redis en mémoire, mais table pour audit)
CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  ip INET,
  email TEXT,
  event TEXT NOT NULL, -- login.failed, otp.failed, kyc.reject
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_ip ON security_events(ip, created_at);

-- MFA
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT; -- encrypted
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS niss_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS niss_last4 TEXT;

-- Documents hardening (S3 SSE-KMS déjà, on ajoute)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS s3_key TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS scan_status TEXT DEFAULT 'PENDING' CHECK (scan_status IN ('PENDING','CLEAN','INFECTED'));

-- Audit déjà existant audit_logs — on s'assure INSERT only (à créer rôle en prod)
-- no UPDATE/DELETE granted
