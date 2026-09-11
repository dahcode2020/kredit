# KREDIT — Sécurité & Audit complets

> Toutes les actions sensibles sont journalisées, corrélables, vérifiables, alertées. Aucune donnée sensible en clair. Human-in-the-loop, MFA admin, hash-chaîne, rate limiting, détection anomalie, rotation, sauvegardes, DR.

---

## 0. Principes

- **Audit append-only hash-chaîné** : `hash = sha256(prev_hash + payload)` vérifiable, `UPDATE/DELETE` bloqués par trigger, `INSERT` seule voie (rôle dédié). Export WORM S3 quotidien.
- **Jamais de PII sensible en clair dans les logs** : `redaction.util.ts` — `password/*, secret, token, niss, iban, pan, cvv` → `[REDACTED]` ou `[REDACTED:sha256:12]`. `before/after` = diff redacted uniquement.
- **Corrélation** : `X-Request-Id` / `X-Correlation-Id` (UUID v4) propagé PWA → API → queues → audit/security → Loki. `correlationId` obligatoire dans chaque log.
- **Séparation** : `audit_logs` (métier) vs `security_logs` (sécurité) + vue `v_investigation` pour timeline corrélée.

---

## 1. Audit log — schéma (007_security_audit.sql)

**Table `audit_logs`** (patch de l'existant) :

```sql
audit_logs(
  id BIGSERIAL PK,
  actor TEXT,              -- email ou id string (pour investigation, accès restreint ADMIN)
  actor_id UUID FK users,
  actor_type actor_type,   -- CUSTOMER|ADMIN|SUPER_ADMIN|SYSTEM|ANONYMOUS
  action audit_action,     -- voir §2
  entity_type entity_type, -- USER|KYC|APPLICATION|DOCUMENT|DECISION|RULE|RATE_RULE|PRODUCT|INVESTMENT_PRODUCT|PAYMENT|REFUND|ADMIN|COUNTRY|NOTIFICATION|SESSION
  entity_id TEXT,
  timestamp TIMESTAMPTZ,   -- alias created_at, index DESC
  ip INET,
  user_agent TEXT,
  before JSONB,            -- diff redacted
  after JSONB,
  reason TEXT,             -- motif métier (sanitize)
  correlation_id TEXT,     -- X-Request-Id
  hash TEXT NOT NULL,
  prev_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
)
-- Indexes: actor, actor_type, action, entity_type+entity_id, ip, correlation_id, timestamp
-- Trigger: BEFORE UPDATE OR DELETE RAISE EXCEPTION 'append-only'
```

**Vue investigation** :

```sql
CREATE VIEW v_investigation AS
  SELECT 'AUDIT' as source, id, actor, actor_type, action as event, entity_type, entity_id, ip, user_agent, correlation_id, timestamp, reason, before, after FROM audit_logs
  UNION ALL
  SELECT 'SECURITY' as source, id, actor, actor_type, event_type as event, entity_type, entity_id, ip, user_agent, correlation_id, created_at as timestamp, null as reason, metadata as before, null as after FROM security_logs
  ORDER BY timestamp;
```

Requête investigation : `SELECT * FROM v_investigation WHERE correlation_id='req_abc' ORDER BY timestamp;` → timeline complète login→upload→decision même avec IP/NAT.

---

## 2. Actions auditées — couverture exhaustive

| Catégorie | Action `audit_action` | Déclencheur | Entity | Champs before/after |
|-----------|------------------------|-------------|--------|---------------------|
| **Auth** | `auth.login` | `POST /auth/login` succès | `USER / id` | after `{email, role, mfa}` (password jamais logué) |
| | `auth.logout` | `POST /auth/logout` | `SESSION / jti` | reason `user initiated` |
| | `auth.register` | `POST /auth/register` | `USER / id` | after `{email, locale}` |
| | `auth.password_change` | `PUT /customer/security/password` | `USER / id` | before/after redacted `[REDACTED:sha256]` |
| | `auth.email_change` | `PUT /customer/profile {email}` | `USER / id` | before `{email:old}` after `{email:new}` |
| | `auth.phone_change` | `PUT /customer/profile {phone}` | `USER / id` | before/after last4 seul |
| | `auth.mfa_enable/verify/disable` | `POST /auth/2fa` | `USER / id` | after `{mfa_enabled}` |
| **Customer** | `customer.update` | `PUT /customer/profile` | `USER / id` | diff adresse/locale redacted |
| **Documents** | `document.upload` | `POST /credit/applications/:id/documents` | `DOCUMENT / docId` | after `{code,mime,sha256,scan:CLEAN}` |
| | `document.view_sensitive` | `GET /documents/:id/view` (URL présignée 5m) | `DOCUMENT / docId` | before `{s3Key:[REDACTED]}` |
| | `document.delete` | `DELETE .../documents` | `DOCUMENT / docId` | reason |
| **Applications** | `application.create` | `POST /credit/applications` | `APPLICATION / KRD-...` | after `{amount,term,product}` |
| | `application.update` | `PUT /credit/applications/:id` (DRAFT) | `APPLICATION / id` | diff redacted |
| | `application.status_change` | workflow `DRAFT→SUBMITTED→KYC_PENDING…` | `APPLICATION / id` | before `{status:old}` after `{status:new}` + `history` |
| **Décisions** | `decision.approve` | `POST .../approve` | `DECISION / appId` | reason, after `{status:APPROVED}` |
| | `decision.reject` | `POST .../reject` | `DECISION / appId` | reason obligatoire |
| | `decision.exception` | `POST .../approve-with-exception` | `DECISION / appId` | `exceptionReason` + `amount>50000 → SUPER_ADMIN` |
| | `decision.request_information` | `POST .../request-information` | `DECISION / appId` | reason + docs demandés |
| **Config** | `rule.create/update/delete` | `POST/PUT /admin/rules` | `RULE / id` | before/after `{key,value,is_hard}` |
| | `rate_rule.create/update` | `/admin/rate-rules` | `RATE_RULE / id` | before/after taux |
| | `product.create/update` | `/admin/products` | `PRODUCT / id` | diff |
| | `investment_product.*` | `/admin/investments` | `INVESTMENT_PRODUCT / id` | diff + `yield_config` |
| **Paiements** | `payment.create` | `POST /payments` | `PAYMENT / pay_...` | after `{amount,currency,provider,loanId}` idempotencyKey |
| | `payment.confirm` | webhook `paid` ou admin confirm | `PAYMENT / id` | before `PROCESSING` after `SUCCEEDED` + `provider_payment_id` |
| | `payment.refund` | `POST /payments/:id/refund` | `REFUND / id` | reason |
| | `payment.reconcile` | cron | `PAYMENT / id` | raw_payload redacted |
| **Admin** | `admin.create/update/disable` | `POST /admin/administrators` | `ADMIN / id` | after `{email,role}` password jamais logué |
| **Settings** | `settings.update` | `PUT /admin/settings` | `COUNTRY / BE` | diff |
| | `notification.send/preference_update` | notif | `NOTIFICATION / id` | payload redacted |

Toutes via `AuditInterceptor` (`@Audited({action, entityType})`) + `AuditService.log()` manuel pour cas fins (login).

**Exemple log** :

```json
{
  "id": 1042,
  "actor": "admin@kredit.be",
  "actor_id": "usr_admin_1",
  "actor_type": "ADMIN",
  "action": "decision.exception",
  "entity_type": "APPLICATION",
  "entity_id": "KRD-2026-0842",
  "timestamp": "2026-09-11T07:30:12.123Z",
  "ip": "185.12.34.56",
  "user_agent": "Mozilla/5.0 ...",
  "before": {"status":"UNDER_ADMIN_REVIEW","amount":15000},
  "after": {"status":"APPROVED_WITH_EXCEPTION","exceptionReason":"Client historique <10% plafond, dérogation justifiée ..."},
  "reason": "Dérogation demandée (plafond dépassé de 8%).",
  "correlation_id": "req_9c1e-... ",
  "hash": "a3f9c…",
  "prev_hash": "b2e1…"
}
```

**Interrogation** :

```sql
-- Timeline dossier
SELECT * FROM audit_logs WHERE entity_type='APPLICATION' AND entity_id='KRD-2026-0842' ORDER BY timestamp;
-- Investigation corrélation (PWA offline sync idempotente)
SELECT * FROM v_investigation WHERE correlation_id='req_9c1e' ORDER BY timestamp;
-- Timeline acteur
SELECT action, entity_type, entity_id, ip, timestamp FROM audit_logs WHERE actor='admin@kredit.be' ORDER BY timestamp DESC LIMIT 50;
-- Vérif intégrité
SELECT * FROM audit_logs ORDER BY id; -- AuditService.verifyChain() recalcule SHA256(prev+payload)
```

---

## 3. Redaction — jamais de secret en clair

`backend/src/modules/audit/redaction.util.ts`

- **Clés sensibles** : `password, password_hash, secret, mfa_secret, totp, otp, token, accessToken, refreshToken, authorization, niss, iban, pan, cvv, privateKey`
- **Patterns** : `/iban/i, /pan/i, /card.*number/i, /secret/i`
- **Traitement** : `value string sensible → [REDACTED]` ou `[REDACTED:sha256:12]` (12 chars hash FNV pour corréler sans révéler). Objets imbriqués recursifs, `depth>6 → [MAX_DEPTH]`, circulaire → `[CIRCULAR]`.
- **Diff** : `diffBeforeAfter` ne garde que champs modifiés.
- **Reason** : `sanitizeReason` remplace `password=...` / `token=...`.

Stockage chiffré :

- **NISS** : `niss_hash=sha256(niss+pepper)` + `niss_last4` seul en clair, `identity_data` → `pgp_sym_encrypt(JSON, ENCRYPTION_KEY)` (Vault)
- **IBAN** : `pgp_sym_encrypt`, `last4` seul affiché
- **MFA secret** : `EncryptionService.encrypt(secret)` (AES-256-GCM, IV:tag:cipher)
- **S3 docs** : `SSE-KMS` (CMK `alias/kredit-be`), URL présignée 5-15m, `sha256` stocké

---

## 4. Security logs `security_logs`

```sql
security_logs(id BIGSERIAL, actor_id UUID, actor_type actor_type, actor TEXT, event_type security_event_type, entity_type entity_type, entity_id TEXT, ip INET, user_agent TEXT, metadata JSONB, correlation_id TEXT, severity INFO|WARN|CRITICAL, created_at)
-- Indexes: actor, event_type, ip, correlation_id, severity+CRITICAL
```

**Types** `security_event_type` : `LOGIN_FAILED/SUCCESS, LOGOUT, PASSWORD_CHANGE, BRUTE_FORCE, RATE_LIMITED, ANOMALY_* , MFA_FAILED/SUCCESS, LOCKOUT/UNLOCK, SECRET_ROTATED, BACKUP_CREATED`

Tous redacted via `redact(metadata)`.

---

## 5. Détection anomalie `AnomalyDetectorService`

Règles temps réel (in-memory + Redis) :

| Anomalie | Seuil | Risk | Action |
|----------|-------|------|--------|
| **VELOCITY** | >3 dossiers /1h ou >5/24h par `customerId` | MEDIUM | `security_logs ANOMALY_VELOCITY` + audit `security.anomaly_detected` + alerte si HIGH |
| **IMPOSSIBLE_TRAVEL** | distance >900km/h via IP géoloc lat/lon | CRITICAL | alerte ADMIN + bloc `riskLevel=HIGH` |
| **DEVICE_CHANGE** | `userAgent` change rapide | MEDIUM | flag |
| **BRUTE_FORCE** | 5 fails login /15m (voir §6) | CRITICAL | lockout |
| **DUPLICATE_DOC** | même `sha256` doc sur 2 customers | HIGH | escalade SUPER_ADMIN |
| **NISS_DUPLICATE** | même `niss_hash` sur 2 comptes | CRITICAL | bloquant SUPER_ADMIN |
| **RATE_LIMIT** | burst > seuil | WARN | log |

`AnomalyDetectorService.checkVelocity/ImpossibleTravel/DeviceChange/DuplicateDoc()` → `audit.logSecurity + audit.log(security.anomaly_detected)`. Table `anomaly_events(customer_id, type, details, risk_level, status OPEN→RESOLVED)` pour suivi.

---

## 6. Rate limiting & verrouillage

**Service** `RateLimiterService` (ioredis si `REDIS_URL`, sinon Map fallback)

- **Login** : `5/min` par `IP` **et** par `email` (fenêtre glissante 60s). Dépassé → `429 + Retry-After + RATE_LIMITED` security log.
- **Lockout** : après **5 échecs /15m** par email → verrouillé 15m (`audit security.lockout` + `security_logs BRUTE_FORCE CRITICAL` + `AlertService.onBruteForce` email admins + SIEM). Table `login_attempts(email,ip,success,failure_reason,correlation_id)` + `rate_limit_counters(key,window_start,count,blocked_until)`.
- **OTP** : `3/min` par téléphone/email, code TTL 5m, max 3 essais → `RATE_LIMITED`
- **Global** : `100/min` IP, `20/min` auth (nestjs-throttler + Redis)
- **Headers** : `X-RateLimit-Limit/Remaining/Reset`, `429` avec `code:RATE_LIMITED`

`isLocked(email,ip)` vérifie fenêtre 15m ; `resetOnSuccess(email)` purge compteurs.

**Middleware** `CorrelationMiddleware` : `X-Request-Id` (UUID) → `req.correlationId`, `res.setHeader X-Request-Id/X-Correlation-Id`.

---

## 7. Alertes `AlertService`

- **Canaux** : `EMAIL` (SES), `SMS` (Twilio), `PUSH`, `WEBHOOK` (SIEM/Loki)
- **Outbox** `alerts(channel,recipient,template,payload,status)` → queue BullMQ → providers avec retry
- **Admins** : `ALERT_ADMIN_EMAILS=admin@kredit.be,superadmin@kredit.be` + `SIEM_WEBHOOK_URL`
- **Critiques** : `BRUTE_FORCE, IMPOSSIBLE_TRAVEL, NISS_DUPLICATE, RATE_LIMIT>threshold, ANOMALY HIGH/CRITICAL` → `alertAdmins()` immédiat
- **Sample** : rate-limited alerts échantillonnées 10% pour SIEM

---

## 8. MFA Admin

- **Obligatoire** `ADMIN/SUPER_ADMIN` : `mfa_enabled=true`, `mfa_secret` chiffré, `mfa_verified_at`
- **Guards** : `@RequireMFA()` + `MfaGuard` (`RequireMFA_KEY`). Vérifie `ADMIN/SUPER_ADMIN` ont `mfa_verified_at` <5m, sinon `403 MFA_REQUIRED / MFA_EXPIRED`.
- **Endpoints** : `POST /auth/2fa {action:enable|verify|disable, code?}` → `otpauth://totp/KREDIT:email?secret=...` QR, TOTP 6 chiffres TTL 30s, backup codes.
- **Audit** : `auth.mfa_enable/verify/disable` loggés.

---

## 9. Rotation des secrets

**Service** `SecretRotationService` + table `secret_rotations(secret_name, old_key_id, new_key_id, rotated_by, reason, correlation_id)`

| Secret | Cycle | Procédure |
|--------|-------|-----------|
| **JWT_RS256** | 90j | génère `newKeyId`, double-write (signe new, vérifie old+new), TTL JWT 15m → old révoquée après 7j (refresh max) |
| **ENCRYPTION_KEY (AES-256-GCM)** | 90j | `Vault transit rotate`, ré-encrypte lazy (read old, write new) + batch nightly, garde old pour déchiffrement |
| **NISS_PEPPER / MFA_PEPPER** | 180j ou incident | nouveau pepper, re-hash en batch, old pepper gardé pour vérif |
| **S3 KMS CMK** | 1an (AWS auto) | `ScheduleKeyDeletion` + `CreateAlias` |
| **SESSION_SECRET** | 90j | rotation + invalidation sessions |

`rotate(secretName, rotatedBy, reason, correlationId)` → log `security.secret_rotated` + alerte INFO. Scheduler cron `0 3 * * 0` vérifie âge >80j → WARN, >90j → auto-rotate (SUPER_ADMIN approval requis en prod si critique).

**Urgence** : incident → `rotate(..., reason:'incident', correlationId)` + révocation immédiate + notif SIEM CRITICAL.

---

## 10. Sauvegardes & Disaster Recovery

**Service** `BackupService` + tables `backup_jobs(type, location, size_bytes, checksum, encrypted, pitr_target)` + `dr_tests(scenario, result, rpo, rto)`

| Type | Fréquence | Destination | Chiffrement | Rétention | RPO/RTO |
|------|-----------|-------------|-------------|----------|--------|
| **PG base** | quotidien 03:00 | `s3://kredit-backups/pg/base/` | AES-256-GCM + KMS | 7j S3 STANDARD | RPO 5m (WAL) |
| **PG WAL** | continu (WAL-G archiving) | `s3://kredit-backups/pg/wal/` | idem | 7j | PITR 7j |
| **S3 docs** | versioning + replication cross-region `eu-west-1→eu-central-1` | `s3://kredit-docs` | SSE-KMS | 30j STANDARD → 90j GLACIER, légal 5 ans si validé | RPO 0 (versioning) |
| **Redis RDB** | `save 900 1` + AOF + snapshot quotidien S3 | `s3://kredit-backups/redis/` | idem | 7j | RTO 15m |

**Tests** :

- **PITR quotidien** 04:00 sur replica → `RESTORE UNTIL 'now-1h'` + `verifyChain()` audit_logs hash → SUCCESS/FAIL
- **Full restore hebdo** dimanche 04:00 → mesure RPO/RTO → rapport SUPER_ADMIN + `dr_tests`
- **DR quarterly** : simulation `AZ_FAILURE`, `PG_FAILOVER`, `S3_RESTORE`, `FULL_RESTORE` → `RPO 5min, RTO 1h` validés

**Procédure restore** (runbook) :

```bash
# 1. Isoler
kubectl scale deployment backend --replicas=0 && aws s3 ls s3://kredit-backups/pg/base/ --recursive | tail
# 2. Restore base + WAL jusqu'à PITR
wal-g backup-fetch /var/lib/postgresql/data LATEST && wal-g wal-fetch ... --target-time "2026-09-11 03:00 UTC"
# 3. Vérif
psql -c "SELECT count(*) FROM audit_logs;" && node -e "require('./dist/modules/audit/audit.service').verifyChain()"
# 4. Reprise
kubectl scale deployment backend --replicas=3 && curl -f https://api.kredit.be/health
```

---

## 11. Intégration API — audité par défaut

**Middleware** `CorrelationMiddleware` (`X-Request-Id` → `correlationId`)

**Intercepteur** `AuditInterceptor` (`@Audited`):
```ts
@Post('applications')
@Audited({ action:'application.create', entityType:'APPLICATION' })
@RequireMFA()
async create(@Body() dto, @Req() req) { ... } // log auto: actor, ip, ua, correlation, before/after redacted, hash chaîné
```

**Manuel** (login) :
```ts
await audit.log({ actor: email, actor_id: user.id, actor_type: user.role, action:'auth.login', entity_type:'USER', entity_id: user.id, ip, user_agent, correlation_id });
await audit.logSecurity({ event_type:'LOGIN_SUCCESS', actor_id: user.id, ip, user_agent, correlation_id, severity:'INFO' });
```

**Rate limit** :
```ts
const {allowed, retryAfterMs} = await rateLimiter.checkLoginRateLimit(ip, email, correlationId);
if (!allowed) throw new HttpException({code:'RATE_LIMITED', retryAfterMs}, 429);
```

**Anomalie** :
```ts
await anomaly.checkVelocity(customerId, ip, correlationId);
await anomaly.checkImpossibleTravel(customerId, ip, geo, correlationId);
```

---

## 12. Requêtes investigation — exemples

```sql
-- 1. Timeline dossier KRD-2026-0842 (approbation exception)
SELECT timestamp, actor, action, entity_type, entity_id, ip, reason, before->>'status' as before_status, after->>'status' as after_status, hash
FROM audit_logs WHERE entity_type='APPLICATION' AND entity_id='KRD-2026-0842' ORDER BY timestamp;

-- 2. Corrélation PWA offline sync (idempotence)
SELECT * FROM v_investigation WHERE correlation_id='req_9c1e-4f2a' ORDER BY timestamp;

-- 3. Brute force IP
SELECT * FROM security_logs WHERE event_type='BRUTE_FORCE' AND ip='1.2.3.4' ORDER BY created_at DESC;
SELECT * FROM login_attempts WHERE ip='1.2.3.4' AND success=false ORDER BY created_at DESC LIMIT 20;

-- 4. Vérif chaîne hash (doit retourner valid=true)
-- via API GET /admin/audit-logs/verify ou SQL:
SELECT id, hash, prev_hash FROM audit_logs ORDER BY id;

-- 5. Anomalies non résolues HIGH
SELECT * FROM anomaly_events WHERE status='OPEN' AND risk_level='HIGH' ORDER BY created_at DESC;

-- 6. Rotation secrets 90j
SELECT * FROM secret_rotations WHERE secret_name='JWT_RS256' ORDER BY rotated_at DESC LIMIT 5;
```

---

## 13. Observabilité & SIEM

- **Logs structurés** : Pino JSON → Loki (Grafana) `audit.*`, `security.*`, `rate.*` avec `correlation_id`, `actor`, `ip`
- **Métriques** : Prometheus `audit_logged_total{action}`, `security_events_total{event_type}`, `rate_limited_total`, `anomaly_total`
- **Alerting** : Grafana → Slack/PagerDuty si `CRITICAL` ou `anomaly HIGH` ou `verifyChain valid=false`
- **Sentry** : `CRITICAL` + `hash chain broken` → issue

---

## 14. Tests & conformité

- **Unit** : `redaction.util.spec.ts` (jamais de password en clair), `audit.service.spec.ts` (hash chain), `rate-limiter.spec.ts` (5/min lockout), `anomaly.spec.ts`
- **E2E** : login 5 fails → `423 LOCKED`, `security_logs BRUTE_FORCE`, audit `security.lockout`
- **Pentest** : OWASP ZAP, vérif `X-Request-Id` header, pas de PII en logs, HSTS, CSP
- **RGPD** : DPIA, DPA, registre traitements, droit effacement → anonymisation `users` (`email→hash@deleted`) mais conservation `audit_logs` 5 ans légale (art. 6.1.c)

---

## 15. Fichiers

```
database/migrations/007_security_audit.sql
backend/src/modules/audit/entities/audit-log.entity.ts
backend/src/modules/audit/entities/security-log.entity.ts
backend/src/modules/audit/redaction.util.ts
backend/src/modules/audit/audit.service.ts
backend/src/modules/audit/decorators/audited.decorator.ts
backend/src/modules/audit/interceptors/audit.interceptor.ts
backend/src/modules/audit/audit.controller.ts
backend/src/modules/audit/security.controller.ts
backend/src/modules/audit/audit.module.ts
backend/src/common/decorators/require-mfa.decorator.ts
backend/src/common/guards/mfa.guard.ts
backend/src/common/security/rate-limiter.service.ts
backend/src/common/security/anomaly-detector.service.ts
backend/src/common/security/alert.service.ts
backend/src/common/security/secret-rotation.service.ts
backend/src/common/security/backup.service.ts
backend/src/common/security/siem.service.ts
backend/src/common/security/security.module.ts
backend/src/common/middleware/correlation.middleware.ts
docs/security-audit.md
```

> **Ne jamais loguer `password`, `secret`, `token`, `niss`, `iban`, `pan` en clair — `redact()` obligatoire, test CI échouant si pattern détecté dans `audit_logs.before/after`.**
