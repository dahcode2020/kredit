# KREDIT — KYC / AML / Antifraude & Sécurité

> KYC basique validé **uniquement** par `ADMIN` / `SUPER_ADMIN` (pas de fournisseur externe en MVP). Architecture prête à brancher `KycProvider`/`AmlProvider` sans toucher au domaine. Conformité BE/EU par design.

---

## 1. Principes

- **KYC manuel en MVP** : l’admin vérifie visuellement ID + adresse + téléphone + email. Aucun appel externe obligatoire. Toute automatisation future passe par **interfaces**.
- **Jamais de dépendance directe à un provider** : le domaine dépend de `KycProvider`, `AmlProvider`, `FraudDetectionProvider` (ports). `MockKycProvider` en dev, `AdminManualProvider` en prod MVP, `Onfido/Veriff/ComplyAdvantage` branchables en 1 ligne de DI.
- **Compliance Layer** : agrège `KYC + AML + sanctions + fraude + vérification docs` → `ComplianceResult { status, reasons, riskLevel, blocked }`. Le `Credit Decision Engine` ne peut approuver si `compliance.blocked=true`.
- **Human-in-the-loop** : `KYC_VERIFIED` seul un humain peut le poser. Pas de `AUTO_VERIFIED`.
- **Audit & chiffrement** : toute vérification = `audit_logs` hash-chaîné + chiffrement au repos (`pgcrypto`, S3 SSE-KMS) + URLs présignées courtes.

---

## 2. Flux — Customer → KYC → Compliance → Crédit

```
[Customer] —upload ID+adresse—> [Documents S3 présigné + ClamAV]
                │
                ▼
        [KycVerificationService] —crée KycVerification {NOT_STARTED}
                │  via KycProvider (AdminManualProvider en MVP)
                ▼
        [ADMIN / SUPER_ADMIN] —vue back-office /admin/kyc-queue
           vérifie ID (MRZ, dates, photo), adresse (facture <3m), téléphone (OTP), email (OTP), cohérence
           → actions {APPROVE, REJECT, REQUEST_MORE_INFO} + motif + pièces
                │
                ▼
        [Compliance Layer] —re-joue règles:
           - AML (cohérence revenus/dépenses, pays à risque)
           - Sanctions (si légalement requis — voir §8)
           - Fraude (doublons, vélocité, device)
           - Vérif docs (statuts S3)
           → ComplianceResult {VERIFIED|REJECTED|PENDING, riskLevel, reasons}
                │
                ▼
        [Credit Decision Engine] —bloqué si compliance != VERIFIED
```

**Workflow application** : `KYC_PENDING` tant que KYC != VERIFIED. Transition `KYC_PENDING → SCORING` uniquement si `kyc.status=VERIFIED`.

---

## 3. Vérifications couvertes (MVP basique)

| Vérification | Collecte | Validation MVP (admin) | Validateur | Stockage |
|--------------|----------|------------------------|------------|----------|
| **Identité** | Nom, prénom, date naiss., NISS hash, nationalité | Contrôle visuel carte ID/passport (recto/verso), dates validité, MRZ lisible, photo vs. déclaration | ADMIN | `kyc_verifications.identity_data` chiffré |
| **Document ID** | Upload S3 `ID_FRONT/BACK` | Vérif type (BE eID/passport), netteté, non expiré, non falsifié (visuel + ClamAV + hash) | ADMIN | `documents` status `VERIFIED/REJECTED` |
| **Selfie/liveness** | *Non requis en MVP* | — (prévu interface `LivenessProvider` si besoin) | — | — |
| **Adresse** | Rue, n°, boîte, CP, ville, BE | Facture énergie/télécom <3 mois ou attestation commune, cohérence CP/ville BE | ADMIN | `kyc_verifications.address_data` |
| **Téléphone** | `+32...` | OTP SMS 6 chiffres (Twilio) + vérif format `libphonenumber-js` BE | Système + ADMIN | `users.phone_verified_at` |
| **Email** | `*@*` | OTP Email 6 chiffres (SES) + vérif MX | Système | `users.email_verified_at` |
| **AML basique** | Revenus, emploi, purpose | Checklist admin : cohérence revenus/charges, pays à risque, PEP (case à cocher), source fonds (salaire/indépendant) | ADMIN | `compliance_checks` |
| **Sanctions** | Nom, DOB, pays | **Si légalement requis** : requête manuelle listes UE/ONU/BE (voir §8) — en MVP case `sanctions_checked_at` + `sanctions_hit=false` par défaut, escalade SUPER_ADMIN si doute | SUPER_ADMIN | `aml_checks` |
| **Fraude** | Device, IP, vélocité | Règles auto (§5) + revue admin si flag | Système + ADMIN | `fraud_checks` |
| **Docs** | S3 | ClamAV + type MIME + taille + OCR léger (nom/date) | Système + ADMIN | `documents` |

**NISS** : jamais stocké en clair → `niss_hash = sha256(niss + pepper)` + `niss_last4` seul en clair.

---

## 4. Architecture & interfaces (abstraction provider)

```ts
// kyc/providers/kyc-provider.interface.ts
export interface KycProvider {
  readonly name: string; // 'admin-manual' | 'onfido' | 'mock'
  startVerification(input: KycStartInput): Promise<{ verificationId: string; status: KycStatus }>;
  getResult(verificationId: string): Promise<KycResult>;
  handleWebhook?(payload: any): Promise<void>;
}
export interface AmlProvider {
  screen(customer: CustomerSnapshot): Promise<AmlResult>; // sanctions/PEP/adverse media
}
export interface FraudDetectionProvider {
  evaluate(event: FraudEvent): Promise<FraudResult>; // velocity, device, doublons
}
export interface DocumentVerificationProvider {
  verify(documentId: string): Promise<DocumentVerdict>;
}
```

**Implémentations MVP** :

- `AdminManualProvider implements KycProvider` : `startVerification` → crée `kyc_verifications` `IN_REVIEW`, notifie admin; `getResult` → lit `kyc_verifications.status` posé par admin.
- `MockAmlProvider` : retourne `CLEAR` sauf si `country in [high-risk]` → `REVIEW`.
- `BasicFraudProvider` : règles en code (vélocité, doublons) sans ML.

**DI** :

```ts
@Module({
  providers: [
    { provide: 'KycProvider', useClass: AdminManualProvider }, // swap → OnfidoProvider sans toucher KycService
    { provide: 'AmlProvider', useClass: MockAmlProvider },
    KycVerificationService, ComplianceLayer,
  ]
})
```

`KycVerificationService` ne connaît que les interfaces — jamais `Onfido`.

---

## 5. KYC basique — modèle & statuts

```sql
CREATE TYPE kyc_status AS ENUM ('NOT_STARTED','IN_REVIEW','VERIFIED','REJECTED','EXPIRED');
CREATE TABLE kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) UNIQUE,
  status kyc_status NOT NULL DEFAULT 'NOT_STARTED',
  identity_data JSONB, -- {firstName,lastName,dob,niss_hash,niss_last4,nationality} chiffré
  address_data JSONB,  -- {street,number,box,postal,city, country:'BE'} chiffré
  phone TEXT, phone_verified_at TIMESTAMPTZ,
  email TEXT, email_verified_at TIMESTAMPTZ,
  documents JSONB DEFAULT '[]', -- [{code:'ID_FRONT', status:'VERIFIED'}]
  verified_by UUID REFERENCES users(id), -- ADMIN qui a validé
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ, -- VERIFIED +12 mois BE
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);
```

**Transitions** (seul ADMIN/SUPER_ADMIN peut `VERIFY/REJECT`, CUSTOMER peut `SUBMIT`) :

```
NOT_STARTED --(customer upload)--> IN_REVIEW --(ADMIN approve)--> VERIFIED (expires +12m)
                                   |                \
                                   |                 --(ADMIN reject + motif)--> REJECTED --(customer re-upload)--> IN_REVIEW
                                   --(12m sans re-vérif)--> EXPIRED
```

**Qui valide** : `KycController @Roles('ADMIN','SUPER_ADMIN')` + `@RequireMFA()` + `Audit`.

---

## 6. Antifraude basique (sans ML)

| Règle | Seuil | Action |
|-------|-------|--------|
| **Vélocité demandes** | >3 dossiers / 24h même `customer_id` | flag `FRAUD_VELOCITY` → `REVIEW` |
| **Doublons docs** | même hash SHA256 `documents` sur 2 customers | flag `FRAUD_DUPLICATE_DOC` |
| **Téléphone/email jetable** | liste domaines jetables | flag |
| **IP / device** | IP hors UE + changement rapide | log + flag |
| **Incohérence revenus** | revenus déclarés vs. estimation BE (seuils produits) | soft warning scoring |
| **NISS doublon** | même `niss_hash` sur 2 comptes | bloquant `FRAUD_NISS_DUPLICATE` → SUPER_ADMIN |

Tout flag → `compliance.riskLevel=HIGH` → `Credit Decision Engine` force `REVIEW` (jamais auto-approuve).

---

## 7. Vérification documents & uploads

- **Upload** : `POST /documents/presign {code, mime, size}` → `PUT S3` URL présignée 15 min (`X-Amz-Expires:900`), `Content-MD5` obligatoire. Pas d’URL publique.
- **Antivirus** : queue `documents.virus-scan` → `ClamAV` (sidecar) → `INFECTED` → `REJECTED` + alerte.
- **Contrôles** : MIME whitelist `pdf/jpg/png`, taille `≤10MB`, dimensions, OCR léger (nom/date vs. `kyc_verifications`).
- **Chiffrement** : S3 `SSE-KMS` (`aws:kms` CMK `alias/kredit-be`), Postgres `pgp_sym_encrypt` pour `identity_data` (clé Vault).
- **URLs temporaires** : `GET /documents/:id/view` → redirige 302 vers URL présignée 5 min, auditée. Pas de stockage local.

---

## 8. AML & sanctions — quand légalement requis

En Belgique / UE, les **prêteurs** et **intermédiaires de crédit** (et pas une simple plateforme tech) sont assujettis **LBC/FT** si agrément (loi 18/09/2017). **KREDIT n’est pas établissement de crédit** — point à **valider juridiquement**.

- **Si KREDIT devient assujetti** : screening obligatoire listes **UE Consolidated Sanctions**, **ONU**, **BE (CTIF/CFI)**, **PEP** (RDB), avec conservation 5 ans, déclaration CTIF si suspicion.
- **En MVP** (plateforme tech sans agrément, KYC manuel) : on **pré-câble** `AmlProvider.screen()` + `sanctions_checked_at` mais on **ne prétend pas** être conforme sans validation juridique. Bannière `needs_legal_validation=true` sur règle `sanctions`.

**Action** : `AmlProvider` (mock) retourne `CLEAR` par défaut. Si admin coche `doute` → escalade `SUPER_ADMIN` → vérif manuelle externe (WorldCheck/ComplyAdvantage) → log.

**À valider** (§10) : assujettissement, périmètre screening, conservation, déclaration.

---

## 9. Sécurité — chiffrement, secrets, MFA, rate limiting, sessions, RBAC, audit, logs, sauvegardes

### Chiffrement & secrets
- **Transit** : TLS 1.3 partout (HSTS, CSP `default-src 'self'`), `Secure` cookies.
- **Au repos** : Postgres `AES-256-GCM` (`pgcrypto` + clé Vault), S3 `SSE-KMS`, backups chiffrés. Clés rotées 90j via Vault (`transit`).
- **Secrets** : jamais front, `Vault / AWS Secrets Manager` → `process.env` → `ConfigService`. `WHATSAPP_TOKEN`, `SES_SECRET`, `KMS_KEY_ID`, `JWT_SECRET` (RS256). `.env` ignoré Git.
- **NISS / IBAN** : `sha256(pepper)` + `pgp_sym_encrypt`, seul `last4` en clair.

### MFA & auth
- **JWT** : `access 15m` RS256 (`sub, role, locale, country`), `refresh 7j` httpOnly `SameSite=Strict` rotation (révocation si rejoué), `jti` en Redis.
- **MFA TOTP** : obligatoire `ADMIN/SUPER_ADMIN` (`AdminMFAGuard`), optionnel `CUSTOMER` (TOTP `otpauth://`). `mfa_verified_at` requis pour `KYC_VERIFY`.
- **Sessions** : stateless JWT + Redis denylist (`jti`) pour logout. Pas de session serveur.

### Brute force & rate limiting
- **Login** : `5/min` IP+email, lockout 15m après 5 échecs, `audit` `auth.login.failed`.
- **OTP** : `3/min` téléphone/email, code 6 chiffres TTL 5m, max 3 essais.
- **Global** : `nestjs-throttler` + Redis (`100 req/min` IP, `20/min` auth), `Helmet`, `CORS` strict `kredit.be`.

### RBAC (3 rôles)
- `CUSTOMER` : son propre `kyc_verifications` (lecture/édition `NOT_STARTED/REJECTED`), ses `documents`.
- `ADMIN` : `KYC_VERIFY/REJECT`, `DOCUMENT_VERIFY`, `COMPLIANCE_REVIEW`, lecture audit.
- `SUPER_ADMIN` : tout ADMIN + `KMS rotation`, `provider swap`, `sanctions escalade`, `config règles`.

Guard : `@Roles('ADMIN','SUPER_ADMIN')` + `@RequireMFA()` + `@RequireCountry('BE')`.

### Audit & logs sécurité
- `audit_logs` **append-only** hash-chaîné `hash=sha256(prev_hash+payload)`, `prev_hash`, `actor_id, action, entity, before/after, reason, ip, requestId`. Pas de `UPDATE/DELETE` (rôle DB `audit_writer` INSERT only). WORM S3 export.
- `security_logs` (Pino → Loki) : `auth.*, kyc.*, aml.*, fraud.*, upload.*, mfa.*` avec `requestId`, `country`, `locale`.

### Uploads & antivirus
- Voir §7 + `ClamAV` sidecar, queue `documents.virus-scan`, `INFECTED` bloquant.

### Sauvegardes
- Postgres `PITR` (WAL archiving) + `pg_basebackup` quotidien chiffré S3 `eu-central-1`, rétention 30j, test restauration mensuel. `kyc_verifications` inclus.
- S3 versioning + `Object Lock` (WORM) pour `documents`.

---

## 10. Ce qui nécessite validation juridique/réglementaire (BE/UE)

| Sujet | Pourquoi | Statut |
|-------|----------|--------|
| **Qualification KREDIT** : plateforme tech vs. prêteur/intermédiaire de crédit (CDE, loi 25/04/2014, FSMA) | Détermine assujettissement LBC/FT, agrément, prospectus | **À valider** — `needs_legal_validation=true` |
| **KYC manuel suffisant ?** (sans prestataire agréé `itsme®/Onfido`) | Exigence eIDAS / AML pour identification à distance | **À valider** — BE accepte `itsme®` niveau `substantial`, manuel = risque |
| **Conservation NISS / documents** (12m vs. 10 ans) | Loi 18/09/2017 art.60 (5 ans LBC), RGPD minimisation | **À valider** |
| **Screening sanctions/PEP** périmètre & listes (UE/ONU/BE) | Obligation LBC art.19-23 | **À valider** — si assujetti |
| **Traitement données santé/financières** | RGPD art.9, base légale | **À valider** (consent explicite + DPIA) |
| **TAEG / SECCI** mentions | CDE livre VII, dir. crédit conso 2008/48/CE | **À valider** (legal `disclaimer.simulation`) |
| **Echéancier, contrats, signature eIDAS** | eIDAS `qualified` vs. `advanced` | **À valider** |
| **Chiffrement & hébergement** (UE, Schrems II) | RGPD chapitre V, localisation BE/UE | **À valider** (S3 `eu-central-1` ok, US provider = DPA) |
| **Déclaration CTIF/CFI** si soupçon blanchiment | Loi 18/09/2017 art.47 | **À valider** (procédure) |

Tout item `needs_legal_validation=true` bloque `kyc.status=VERIFIED` → `EXPIRED` tant que `validated_by_legal_at IS NULL` (bannière amber).

---

## 11. Intégration avec le crédit

- `KycService.isVerified(customerId)` → `ComplianceLayer.evaluate()` → `CreditDecisionEngine` : si `!verified` ou `compliance.blocked` → `REJECT` ou `REVIEW` forcé.
- `POST /kyc/verify {customerId, decision, reason}` (ADMIN) → `audit` → `event kyc.verified` → `applications` `KYC_PENDING → SCORING`.

---

## 12. Roadmap provider

- **J0 (MVP)** : `AdminManualProvider` seul.
- **J1** : brancher `Onfido` (ID + liveness) derrière `KycProvider` sans changer `KycService`.
- **J2** : `ComplyAdvantage` derrière `AmlProvider` pour PEP/sanctions auto.

---

## 13. Checklist prod

- [x] Migration `kyc_verifications` + `compliance_checks` + `fraud_checks`
- [x] Interfaces `KycProvider/AmlProvider/FraudDetectionProvider`
- [x] `AdminManualProvider` + `KycVerificationService` + `ComplianceLayer`
- [x] `KycController` RBAC ADMIN+MFA + audit
- [ ] Validation juridique BE/UE (§10) — bloquant
- [ ] Test e2e `NOT_STARTED → VERIFIED → SCORING`
- [ ] DPIA RGPD + registre traitements
