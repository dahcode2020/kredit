-- 007_security_audit.sql — Système audit & sécurité complet
-- Audit log structuré + sécurité + détection anomalie + rate limiting + MFA + rotation + sauvegardes
-- Principe : append-only, hash-chaîné, jamais de données sensibles en clair, corrélation X-Request-Id

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE actor_type AS ENUM ('CUSTOMER','ADMIN','SUPER_ADMIN','SYSTEM','ANONYMOUS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM ('USER','KYC','APPLICATION','DOCUMENT','DECISION','RULE','RATE_RULE','PRODUCT','INVESTMENT_PRODUCT','PAYMENT','REFUND','ADMIN','COUNTRY','NOTIFICATION','SESSION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'auth.login','auth.logout','auth.register','auth.refresh',
    'auth.password_change','auth.email_change','auth.phone_change',
    'auth.verify_email','auth.verify_phone','auth.mfa_enable','auth.mfa_verify','auth.mfa_disable',
    'customer.update','customer.view',
    'document.upload','document.view_sensitive','document.delete','document.presign',
    'application.create','application.update','application.submit','application.status_change',
    'decision.approve','decision.reject','decision.exception','decision.request_information',
    'rule.create','rule.update','rule.delete',
    'rate_rule.create','rate_rule.update','rate_rule.delete',
    'product.create','product.update','product.deactivate',
    'investment_product.create','investment_product.update','investment_product.status_change',
    'investment.subscribe','investment.redeem',
    'payment.create','payment.confirm','payment.refund','payment.reconcile',
    'admin.create','admin.update','admin.disable',
    'settings.update','country.update','notification.send','notification.preference_update',
    'security.lockout','security.rate_limited','security.anomaly_detected'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE security_event_type AS ENUM (
    'LOGIN_FAILED','LOGIN_SUCCESS','LOGOUT','PASSWORD_CHANGE','EMAIL_CHANGE','PHONE_CHANGE',
    'BRUTE_FORCE','RATE_LIMITED','ANOMALY_VELOCITY','ANOMALY_IMPOSSIBLE_TRAVEL','ANOMALY_DEVICE_CHANGE',
    'MFA_FAILED','MFA_SUCCESS','LOCKOUT','UNLOCK','SECRET_ROTATED','BACKUP_CREATED','RESTORE_TESTED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- 2. Patch audit_logs (existant depuis 001) — ajoute colonnes manquantes
-- ============================================================
-- actor_type
DO $$ BEGIN
  ALTER TABLE audit_logs ADD COLUMN actor_type actor_type;
EXCEPTION WHEN duplicate_column THEN null; END $$;
-- entity_type (si colonne "entity" existe on garde compat, sinon ajoute entity_type)
DO $$ BEGIN
  ALTER TABLE audit_logs ADD COLUMN entity_type entity_type;
EXCEPTION WHEN duplicate_column THEN null; END $$;
-- migration compat: copier entity -> entity_type si vide
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='entity') THEN
    UPDATE audit_logs SET entity_type = entity::text::entity_type WHERE entity_type IS NULL AND entity IS NOT NULL;
  END IF;
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN ip INET; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN user_agent TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN correlation_id TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
-- actor en clair pour investigation (email ou id string) — distinct de actor_id FK
DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN actor TEXT; EXCEPTION WHEN duplicate_column THEN null; END $$;
-- timestamp alias: on garde created_at comme timestamp officiel, mais ajoute index
DO $$ BEGIN ALTER TABLE audit_logs ADD COLUMN timestamp TIMESTAMPTZ DEFAULT now(); EXCEPTION WHEN duplicate_column THEN null; END $$;
-- mise à jour timestamp depuis created_at si vide
UPDATE audit_logs SET timestamp = created_at WHERE timestamp IS NULL;

-- Indexes investigation
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor_type ON audit_logs(actor_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON audit_logs(ip, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

-- Commentaires colonnes (doc)
COMMENT ON COLUMN audit_logs.actor_type IS 'CUSTOMER|ADMIN|SUPER_ADMIN|SYSTEM|ANONYMOUS — pour filtrage RBAC';
COMMENT ON COLUMN audit_logs.correlation_id IS 'X-Request-Id / X-Correlation-Id — trace end-to-end';
COMMENT ON COLUMN audit_logs.before IS 'JSONB diff avant — jamais de mot de passe/NISS en clair, valeurs chiffrées ou hashées';
COMMENT ON COLUMN audit_logs.after IS 'JSONB diff après — redacted';

-- Règle immutabilité: pas d UPDATE/DELETE (à appliquer via REVOKE en prod, ici trigger bloquant)
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION audit_no_update_delete() RETURNS trigger AS $f$
  BEGIN RAISE EXCEPTION 'audit_logs is append-only — UPDATE/DELETE forbidden (hash chain)'; RETURN NULL; END; $f$ LANGUAGE plpgsql;
EXCEPTION WHEN others THEN null; END $$;
DROP TRIGGER IF EXISTS trg_audit_immutable ON audit_logs;
CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_no_update_delete();

-- ============================================================
-- 3. security_logs — journal sécurité distinct (ISO 27001)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  actor_type actor_type,
  actor TEXT, -- email ou 'anonymous:IP'
  event_type security_event_type NOT NULL,
  entity_type entity_type,
  entity_id TEXT,
  ip INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}', -- context redacted, jamais de secret en clair
  correlation_id TEXT,
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO','WARN','CRITICAL')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sec_actor ON security_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_event ON security_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_ip ON security_logs(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sec_correlation ON security_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_sec_severity ON security_logs(severity, created_at DESC) WHERE severity='CRITICAL';

-- Immutabilité idem
DROP TRIGGER IF EXISTS trg_sec_immutable ON security_logs;
CREATE TRIGGER trg_sec_immutable BEFORE UPDATE OR DELETE ON security_logs
  FOR EACH ROW EXECUTE FUNCTION audit_no_update_delete();

-- ============================================================
-- 4. Rate limiting & lockout — état (Redis source de vérité, PG pour audit durable)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL, -- 'login:ip:1.2.3.4' ou 'login:email:alex@kredit.be' ou 'otp:phone:+32...'
  window_start TIMESTAMPTZ NOT NULL,
  window_seconds INT NOT NULL DEFAULT 60,
  count INT NOT NULL DEFAULT 1,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rl_key ON rate_limit_counters(key, window_start DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT,
  ip INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  correlation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_email ON login_attempts(email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_attempts(ip, created_at DESC);

-- ============================================================
-- 5. Anomalies & alertes
-- ============================================================
CREATE TABLE IF NOT EXISTS anomaly_events (
  id BIGSERIAL PRIMARY KEY,
  customer_id UUID REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('VELOCITY','IMPOSSIBLE_TRAVEL','DEVICE_CHANGE','BRUTE_FORCE','DUPLICATE_DOC','NISS_DUPLICATE','RATE_LIMIT')),
  details JSONB NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW','MEDIUM','HIGH')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED','FALSE_POSITIVE')),
  assigned_to UUID REFERENCES users(id),
  correlation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_anomaly_customer ON anomaly_events(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_status ON anomaly_events(status, risk_level);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL','SMS','PUSH','WEBHOOK','SIEM')),
  recipient TEXT NOT NULL,
  template TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED')),
  correlation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. Secrets rotation journal
-- ============================================================
CREATE TABLE IF NOT EXISTS secret_rotations (
  id BIGSERIAL PRIMARY KEY,
  secret_name TEXT NOT NULL, -- 'JWT_RS256', 'ENCRYPTION_KEY', 'MFA_PEPPER', 'NISS_PEPPER', 'S3_KMS_KEY'
  old_key_id TEXT,
  new_key_id TEXT NOT NULL,
  rotated_by UUID REFERENCES users(id),
  rotated_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  correlation_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_secret_name ON secret_rotations(secret_name, rotated_at DESC);

-- ============================================================
-- 7. Backups & disaster recovery journal
-- ============================================================
CREATE TABLE IF NOT EXISTS backup_jobs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('PG_BASE','PG_WAL','S3_DOCS','REDIS_RDB')),
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','FAILED','RUNNING')),
  location TEXT NOT NULL, -- s3://kredit-backups/...
  size_bytes BIGINT,
  checksum TEXT,
  encrypted BOOLEAN DEFAULT true,
  pitr_target TIMESTAMPTZ,
  correlation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backup_type ON backup_jobs(type, created_at DESC);

CREATE TABLE IF NOT EXISTS dr_tests (
  id BIGSERIAL PRIMARY KEY,
  scenario TEXT NOT NULL, -- 'AZ_FAILURE','PG_FAILOVER','S3_RESTORE','FULL_RESTORE'
  result TEXT NOT NULL CHECK (result IN ('PASS','FAIL')),
  rpo_seconds INT,
  rto_seconds INT,
  notes TEXT,
  tested_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 8. Vue investigation (jointure audit+security)
-- ============================================================
CREATE OR REPLACE VIEW v_investigation AS
  SELECT
    'AUDIT' as source,
    id,
    actor, actor_type, action as event, entity_type, entity_id,
    ip, user_agent, correlation_id, timestamp, reason, before, after
  FROM audit_logs
  UNION ALL
  SELECT
    'SECURITY' as source,
    id,
    actor, actor_type, event_type as event, entity_type, entity_id,
    ip, user_agent, correlation_id, created_at as timestamp, null as reason, metadata as before, null as after
  FROM security_logs;

COMMENT ON VIEW v_investigation IS 'Vue unifiée audit+security pour investigation par correlation_id / IP / acteur';
