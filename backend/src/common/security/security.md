# Sécurité — synthèse implémentation

- **Helmet** + `CORS strict` + `CSP default-src 'self'`
- **Rate limiting** : `ThrottlerGuard` 5/min login, 3/min OTP, 100/min global (Redis)
- **Brute force** : lockout 15m après 5 échecs `security_events`
- **Sessions** : JWT RS256 access 15m + refresh 7j httpOnly SameSite=Strict rotation + Redis denylist jti
- **MFA** : TOTP obligatoire ADMIN (`mfa_verified_at`), `otpauth://`
- **RBAC** : `@Roles('ADMIN','SUPER_ADMIN')` + `@RequireMFA()` + `@RequireCountry('BE')`
- **Audit** : `audit_logs` hash-chaîné, INSERT only
- **Uploads** : URL présignée 15m, ClamAV, MIME whitelist, S3 SSE-KMS, SHA256, 10MB
- **Chiffrement repos** : `pgp_sym_encrypt` + `EncryptionService` AES-256-GCM, S3 KMS, backups chiffrés PITR
- **Logs sécurité** : Pino → Loki `auth.*, kyc.*, fraud.*` avec requestId
