# KREDIT — Architecture Technique Complète (v2.0)
## Monolithe Modulaire — MVP product-ready, évolutif vers services séparés

> Date: 2026-09-10 — Belgique (EUR) pilot — FR/EN/NL/DE — Stack: Next.js 14 + NestJS 10 + PostgreSQL 15 + Redis + S3 + BullMQ
> Principes: **Configuration > code dur**, **Human-in-the-loop**, **Simulation ≠ Offre**, **Audit immuable**, **RGPD by design**. N'invente aucune réglementation: toute règle `needs_legal_validation=true` est bloquante tant que `validated_by_legal_at` est null.

---

## 0. Vision & arbitrages

**Type:** Monolithe modulaire (un déploiement, N modules autonomes). Pas de microservices prématurés (coût réseau, transactions distribuées, observabilité). Chaque module a interface claire → extraction future en service = renommage d'import en appel HTTP/queue.

**Extensibilité pays:** `country_code` partout (BE par défaut). Ajouter un pays = ligne `countries` + `products/rates/rules/documents` — zéro code.

**Langues:** `fr,en,nl,de` — DB `*_i18n JSONB`, front `i18n/`, emails/PDFs/validations.

**Devise:** `EUR` par défaut, `numeric(15,2)` jamais `float`. `Decimal.js` côté moteur.

---

## 1. Arborescence canonique (demandée)

```txt
kredit/
├── frontend/
│   ├── app/                    # Next.js App Router — routes par [locale]
│   │   ├── [locale]/
│   │   │   ├── (public)/       # landing, produits, simulateur, à-propos, contact, mentions
│   │   │   ├── (customer)/     # dashboard, applications, échéanciers, documents
│   │   │   ├── (admin)/        # dossiers, scoring, décision
│   │   │   ├── (super)/        # config pays/produits/taux/règles/intégrations/logs
│   │   │   └── layout.tsx
│   │   ├── layout.tsx          # root layout, metadata, viewport
│   │   └── globals.css         # Tailwind + Dewi tokens
│   ├── components/             # UI générique (Button, Card, Modal) — Dewi-inspired
│   │   ├── ui/
│   │   ├── layout/             # Header, Footer, LanguageSwitcher, MobileNav
│   │   └── credit/             # Simulator, AmortizationTable, DecisionTimeline
│   ├── features/               # Domain slices (auth, credit, kyc, admin) — logique métier front
│   │   ├── auth/
│   │   ├── credit-simulation/
│   │   ├── credit-application/
│   │   ├── kyc/
│   │   ├── repayments/
│   │   └── administration/
│   ├── lib/                    # fetcher, decimal, formatters, pwa, security
│   ├── hooks/                  # useAuth, useSimulator, useApplications, useLocale
│   ├── services/               # API clients (REST, idempotency, retry)
│   ├── i18n/                   # messages/{fr,en,nl,de}.json + utils t()
│   ├── styles/                 # tokens Tailwind, gradients Dewi
│   ├── types/                  # DTOs partagés (synchronisés via packages/shared)
│   └── public/
│       ├── manifest.json       # PWA
│       ├── sw.js               # Service Worker Workbox
│       └── icons/192,512.png
├── backend/
│   ├── src/
│   │   ├── main.ts             # bootstrap, helmet, CORS, ValidationPipe, prefix /api/v1
│   │   ├── app.module.ts       # agrégateur
│   │   ├── auth/               # login, register, JWT 15m + refresh rotation, 2FA opt
│   │   ├── customers/          # profil, consent RGPD, préférences notif
│   │   ├── administrators/     # ADMIN (opérationnel) vs SUPER_ADMIN (config sensible)
│   │   ├── countries/          # BE + futurs — feature flag par pays
│   │   ├── kyc/                # vérif identité, statuts, providers (Onfido/itsme)
│   │   ├── credit/             # bounded context crédit (voir §2)
│   │   ├── investments/        # catalogue épargne titres, quiz adéquation MiFID-like
│   │   ├── payments/           # PSP Mollie/Stripe SEPA, webhooks idempotents
│   │   ├── documents/          # upload S3 présigné, virus-scan, OCR, rétention
│   │   ├── notifications/      # orchestrateur Email/SMS/WhatsApp/Push (templates i18n)
│   │   ├── administration/     # façade admin (stats, search, exports)
│   │   ├── audit/              # append-only hash-chaîné, WORM
│   │   ├── security/           # antifraude, rate-limit, velocity, device fp
│   │   └── common/             # guards, decorators, filters, interceptors, pipes, utils
│   ├── test/                   # e2e (Playwright, supertest)
│   └── package.json
├── database/
│   ├── migrations/             # SQL versionné (TypeORM)
│   ├── seeds/
│   │   ├── 001_countries_BE.ts
│   │   ├── 002_products_BE.ts
│   │   └── 003_rules_BE.ts
│   └── schema.sql              # export canon
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml  # postgres, redis, minio, backend, frontend
│   │   ├── Dockerfile.backend
│   │   └── Dockerfile.frontend
│   ├── ci/
│   │   └── github-actions.yml  # lint/test/build/migrate/deploy
│   ├── monitoring/             # Grafana dashboards, Prometheus, Loki, Sentry
│   └── backups/                # PITR, S3 versioning
└── docs/
    ├── architecture.md         # v1 synthèse
    ├── architecture-technique.md # ce fichier (v2)
    ├── database.md             # schéma SQL
    ├── api.md                  # contrats REST + erreurs
    ├── adr/                    # Architecture Decision Records
    └── runbook.md              # ops
```

> Compatibilité actuelle: l'arborescence existante `frontend/app/[locale]/...` et `backend/src/modules/*` a été conservée et **ré-exportée** via `features/` et `credit/*` pour ne rien casser. Les imports `@/features/*` et `src/credit/*` sont des alias.

---

## 2. Modules & responsabilités

### 2.1 Frontend

| Dossier | Responsabilité | Contient | Dépend de |
|---------|---------------|----------|-----------|
| `app/` | Routage, layouts, SSR/SSG, middleware locale, PWA shell | `layout.tsx`, `page.tsx`, `middleware.ts` | `components`, `features`, `i18n`, `services` |
| `components/ui` | Design system Dewi (Button, Card, Badge, Modal, Table, `RelativeTime`) | `Button.tsx` | `styles`, `lib/utils`, `lib/formatters` |
| `components/layout` | Header (dark Dewi), Footer, Nav, LanguageSwitcher | `Header.tsx` | `i18n`, `hooks` |
| `components/credit` | Briques crédit réutilisables | `Simulator.tsx` | `services/simulation` |
| `features/*` | Slices métier front (state + queries + forms) | `features/credit-simulation/{ Simulator, useSimulator, schema }` | `services`, `types`, `hooks` |
| `lib/` | Helpers purs (fetcher, formatEUR, amortize, pwa) | `lib/utils.ts` | — |
| `hooks/` | Hooks partagés (useAuth, useLocale, useDebounce) | `hooks/useAuth.ts` | `services` |
| `services/` | Clients API REST (`fetcher` avec JWT, `x-idempotency-key`, retry) | `services/api.ts` | `types` |
| `i18n/` | Messages ICU, util `t(locale,key)` | `i18n/{fr,en,nl,de}.json` | — |
| `styles/` | Tokens Tailwind (`primary #FF4A17`, `ink #0F1115`) | `tailwind.config.js` | — |
| `types/` | DTOs partagés front/back (via `packages/shared` en prod) | `types/credit.ts` | — |
| `public/` | Assets PWA statiques | `manifest.json`, `sw.js` | — |

**Règle:** `app` n'a pas de logique métier — tout est délégué à `features` + `services`.

**Images:** `next/image` est la norme dans `app/` et `components/` — `@next/next/no-img-element`
y est une **erreur** de lint (`frontend/.eslintrc.json`). Les visuels non optimisés (hero 1920 px,
≈ 1,9 Mo, sans `width`/`height` → CLT/LCP dégradés) passaient par `<img>` ; `<Image>` dimensionne
et transcode via les presets de `next.config.js` (`formats` AVIF/WebP, `deviceSizes`,
`remotePatterns` pour `images.unsplash.com` et `i.pravatar.cc`). **Conséquence à ne pas oublier:**
`sharp` est en `dependencies` et non en `devDependencies` — c'est l'optimiseur de `next start` qui
l'appelle, et le `Dockerfile` runtime ne copie que `node_modules` + `.next`. Sans lui, chaque image
optimisée répond 500 ; le contrôle est
`curl '/_next/image?url=%2F<asset>&w=256&q=75'` → `200 image/webp`.

Le dev n'est **pas** épargné quand le serveur n'a pas de sortie réseau (sandbox, CI, poste derrière
un proxy qui bloque `images.unsplash.com`) : `/_next/image` relaie l'appel distant **depuis le serveur**,
chaque visuel répond alors `500` et Next pose une overlay d'erreur sur une page pourtant saine. D'où
`images.unoptimized: process.env.NODE_ENV !== "production"` dans `next.config.js` — le HTML de dev
référence l'URL d'origine directement (le navigateur, lui, a le réseau), et la prod garde l'optimiseur.

**Dates & heures:** tout affichage utilisateur passe par `lib/formatters.ts` — `resolveDate` ancre
les chaînes sans décalage sur UTC (jamais `new Date("<chaîne>")` dans un composant), le `timeZone`
est forcé à `Europe/Brussels`, et un écart humanisé se rend avec `<RelativeTime>` (premier rendu
déterministe). Voir `docs/hydration.md` §2.10.

### 2.2 Backend — détail par module

#### `auth`
- **But:** Authentification & sessions.
- **Fonctions:** `POST /auth/register, /login, /refresh, /logout, /forgot, /verify-email`. Bcrypt 12, JWT access 15m (RS256/HS256), refresh httpOnly rotation, lockout 5 tentatives, `last_login`, `device_fp` option.
- **Dépendances:** `customers`, `audit`, `security`, `notifications` (email vérif).
- **Interface:** `AuthService.login(email,pass) -> {access, refresh}`, `AuthGuard`, `@CurrentUser()`.
- **Événement:** `auth.login.succeeded`, `auth.login.failed`.

#### `customers` (CUSTOMER)
- **But:** Profil du demandeur.
- **Fonctions:** CRUD profil, adresses, consentements RGPD (`consent_at`, version), préférences `locale`, `risk_level` interne.
- **Dépendance:** `countries` (validation adresse BE), `audit`.
- **Interface:** `CustomersService.get(id)`, `updateProfile(dto)`.

#### `administrators` (ADMIN / SUPER_ADMIN)
- **But:** Séparation stricte opérationnel vs sensible.
- **ADMIN:** gestion clients, consultation dossiers, analyse, documents, **décision finale**, stats, notifs.
- **SUPER_ADMIN:** tout ADMIN + gestion admins, config globale (pays/produits/taux/règles/intégrations), logs/audit, params sensibles.
- **Interface:** `AdminService.listUsers()`, `SuperService.upsertProduct()`.

#### `countries`
- **But:** Multi-tenant UE. BE par défaut, extensible FR/NL/DE/LU.
- **Données:** `code PK 'BE'`, `currency 'EUR'`, `locales [fr,nl,de]`, `config JSONB` (jours fériés, formats, TAEG max légal si validé).
- **Interface:** `CountriesService.getActive()`, `isSupported('BE')`. Utilisé partout via `@Country('BE')` decorator + RLS optionnelle.
- **Cache:** Redis `countries:BE` TTL 5m.

#### `kyc`
- **But:** Connaissance client LBC/FT (loi 18/09/2017 BE).
- **Statuts:** `NOT_STARTED|IN_REVIEW|VERIFIED|REJECTED|EXPIRED` (6 mois, renouvelable).
- **Providers:** `itsme®` (BE), `Onfido/Veriff` — interface `KycProvider` (abstraction, circuit breaker, fallback manuel ADMIN).
- **Interface:** `KycService.start(customerId, country)`, `handleWebhook(providerPayload)`.
- **Async:** queue `kyc.verification`.

#### `credit` — bounded context cœur (voir 2.3)

#### `investments`
- **But:** Catalogue épargne/titres (séparé du crédit pour ne pas requalifier).
- **Fonctions:** Produits `risk 1-7`, quiz adéquation (MiFID-like configurable), souscription, portefeuille. **Disclaimer perte en capital** obligatoire.
- **Dépendance:** `payments`, `documents`, `audit`.

#### `payments`
- **But:** Flux monétaires SEPA.
- **PSP:** Mollie (BE/NL) principal + Stripe fallback. Webhooks idempotents (`idempotency_key` unique, `psp_ref`).
- **Jamais** auto-débit sans mandat SEPA signé.
- **Interface:** `PaymentsService.disburse(applicationId)`, `handleWebhook(event)`.
- **Async:** `payments.disbursement`.

#### `documents`
- **But:** Pièces justificatives.
- **Flow:** Front demande URL présignée → PUT S3 → queue `documents.virus-scan` (ClamAV) → OCR → statut `PENDING|VERIFIED|REJECTED`. Rétention configurable (ex: 10 ans BE), chiffré AES-256, `s3_key` jamais exposée (signed URL 15m).
- **Interface:** `DocumentsService.createPresignedUrl(applicationId, type)`.

#### `notifications`
- **But:** Orchestrateur Email (SES), SMS (Twilio), WhatsApp (Cloud), Push (WebPush VAPID). Templates `i18n` (`notifications/templates/{locale}/{event}.hbs`), préférences user (`email:true, sms:false`), queue + retry + DLQ. Preuve d'envoi dans `audit`.
- **Interface:** `NotificationsService.send(userId, {channel, templateKey, locale, payload})`.

#### `administration`
- **But:** Façade ops (search, stats, exports). Agrège `applications` + `payments` + `audit` sans logique métier.
- **Interface:** `AdminApplicationsController GET /admin/applications?status=PENDING_REVIEW`.

#### `audit`
- **But:** Journal opposable.
- **Table:** `audit_logs(id, actor_id, action, entity, entity_id, before, after, reason, hash, prev_hash, created_at)` — **INSERT only**, hash `SHA256(prev_hash+payload)`, export WORM S3, vérif périodique `hash_chain`.
- **Interface:** `AuditService.log({actor, action, entity, before, after, reason})`. Appelé par interceptor global.

#### `security`
- **But:** Antifraude & protection.
- **Fonctions:** Rate-limit (Redis sliding window), velocity checks, IP/device fingerprint, blocage pays, détection doublons. Règles configurables (`security/rules`).
- **Interface:** `SecurityService.check(req) -> {allow, reason}`.

#### `common`
- **But:** Briques partagées : `guards/RolesGuard`, `decorators/@Roles/@CurrentUser/@Country`, `filters/HttpExceptionFilter`, `interceptors/AuditInterceptor`, `pipes/ValidationPipe`, `utils/crypto, decimal`.

### 2.3 `credit/*` — détail fin

| Sous-module | Responsabilité | Persistance | Synchrone? |
|-------------|----------------|-------------|------------|
| `products/` | Catalogue par pays (PERSONAL/MORTGAGE/BUSINESS). Versionné `effective_from/to`, `is_active`. | `products` | Synchrone (lecture cache) |
| `rules/` | Règles métier configurables (`max_debt_ratio 0.33 soft`, `min_age 18 hard`, `max_amount_BE`). `needs_legal_validation`. Jamais en dur. | `product_rules` | Synchrone (cache) |
| `simulation/` | **Moteur pur** indicatif. Entrée `{amount, term, productType, country}` → `{monthly, taeg, total, schedule, disclaimer, meta:{simulationOnly:true}}`. Méthode française, Decimal.js. Pas de PII obligatoire, pas d'écriture DB (log anonyme). | — (cache 60s) | **Synchrone** (<50ms) |
| `applications/` | Dossier + state-machine (§6). Owner `customer_id`, `country_code`, `product_id`. | `applications` | Synchrone pour R/W, async pour transitions lourdes |
| `scoring/` | Score A-E, `debt_ratio`, `recommendation`. Lit `rules` + `customers` + `applications`. Configurable (pondérations). N'est **jamais** décisif. | `scorings` | **Asynchrone** (queue `scoring.calculate`) |
| `decision-engine/` | **Recommandation** auto (`RECOMMENDED_APPROVE/CONDITIONAL/REJECT`) à partir de `scoring` + `rules`. Ne décide pas. | — | **Synchrone** pur (appelé par scoring) |
| `decisions/` | **Décision humaine** finale (`DECIDED_APPROVED/REJECTED/CONDITIONAL`, `EXCEPTIONAL_*` avec `exception_reason`, `decided_by`, `decided_at`). Guard rôle ADMIN, seuil → SUPER_ADMIN. Audit obligatoire. | `decisions` | **Synchrone** (POST admin) |
| `schedules/` | Génération échéancier français complet (mensualités constantes). Précision `Decimal`. Stocké `jsonb` versionné. | `repayments.schedule` | Synchrone (après décision) |
| `repayments/` | Suivi échéances, `next_due_date`, `status`, impayés, recouvrement. | `repayments`, `payments` | Mixte (cron synchrone, paiements async) |

---

## 3. Dépendances & flux

```
customers ─┬─> auth (JWT)
           ├─> kyc ──> security
           └─> credit/applications ──> credit/scoring ──> credit/decision-engine ──> credit/decisions
                                         │                     │
                                         └─> documents ───────┴─> notifications ──> audit
                                         └─> payments ──> repayments/schedules
countries ─> credit/products/rules/simulation (lu par tous, cache Redis)
audit <── (interceptor global) ── tous les modules (before/after, hash)
security ──> auth, kyc, applications (pré-check)
```

**Règle d'import:** `credit/*` ne dépend jamais de `investments` ni `payments` directement — uniquement via interfaces (`PaymentPort`, `NotificationPort`). Permet extraction future.

---

## 4. Interfaces entre modules (ports)

Chaque module expose `Service` + `Controller` + `Events`. Les dépendances croisées passent par **interfaces TypeScript** (`ports`):

```ts
// credit/scoring -> decision-engine
interface DecisionEnginePort { recommend(scoring: Scoring): Recommendation }
// kyc -> provider
interface KycProvider { verify(payload): Promise<KycResult>; handleWebhook(e): Promise<void> }
// payments -> PSP
interface PspPort { createMandate(dto): Promise<PSPRef>; disburse(ref): Promise<void> }
// notifications -> channels
interface ChannelPort { send(templateKey, locale, payload): Promise<void> }
```

**Fichiers:** `backend/src/credit/decision-engine/ports/decision-engine.port.ts` etc.

**Événements domaine (EventEmitter2 + Bull):** `kyc.verified`, `scoring.completed`, `application.submitted`, `decision.made`, `document.uploaded`, `payment.confirmed`. Payload minimal `{entityId, actorId, country, correlationId}`.

---

## 5. Conventions

### 5.1 Nommmage

| Élément | Convention | Exemple |
|---------|------------|---------|
| Fichiers backend | `kebab-case` | `credit-applications.service.ts` |
| Classes | `PascalCase` + suffixe | `CreditApplicationsService`, `ApplicationsController` |
| Tables | `snake_case` pluriel | `credit_applications`, `product_rules` |
| Colonnes i18n | `*_i18n JSONB` | `name_i18n {fr,en,nl,de}` |
| Endpoints | `kebab-case` pluriel, versionné | `POST /api/v1/credit/applications` |
| Front composants | `PascalCase` | `Simulator.tsx` |
| Hooks | `camelCase` `use*` | `useSimulator.ts` |
| Env | `UPPER_SNAKE` | `DATABASE_URL` |

### 5.2 API REST

- **Prefix** `/api/v1` (versionnement obligatoire, jamais breaking sans `/v2`).
- **Méthodes:** `GET` (cache), `POST` (idempotent avec `x-idempotency-key`), `PUT` (idempotent), `DELETE` soft.
- **Pagination** `?page=1&limit=20` → `{data, meta:{total, page, limit}, links:{next}}`
- **Filtrage** `?status=PENDING_REVIEW&country=BE`
- **Erreurs** enveloppe uniforme:
  ```json
  { "statusCode": 422, "message": "Montant > plafond BE", "code": "CREDIT_AMOUNT_EXCEEDS_CEILING", "details": [{"field":"amount","issue":"max 50000"}], "requestId":"req_9c1e", "timestamp":"..." }
  ```
- **Idempotency:** `x-idempotency-key: uuid` stockée 24h (Redis) — rejoue même réponse sans effet de bord.
- **Correlation:** `x-request-id` propagé logs/audit/queues.

### 5.3 Authentification

- **JWT access** 15m (`sub`, `role`, `locale`, `country`) signé RS256, **refresh** httpOnly `SameSite=Strict` 7j rotation (révocation sur usage double).
- **Bcrypt** `cost 12`, **rate-limit** `5/min` login, **lockout** 15m après 5 échecs.
- **2FA** optionnelle TOTP (feature flag).
- **Middleware:** `AuthGuard` (JWT) → `RolesGuard`.

### 5.4 Autorisation (RBAC 3 rôles)

- Décorateur `@Roles('ADMIN','SUPER_ADMIN')` + `@RequireCountry('BE')`.
- Guards vérifient `req.user.role` + `country_code` match. `SUPER_ADMIN` peut cross-country.
- Tests `canActivate` unit + e2e `403` par rôle.

### 5.5 Validation

- **DTO** `class-validator` + `whitelist:true, forbidNonWhitelisted:true` (pas de mass assignment).
- **Zod** côté front + `react-hook-form`.
- **Règles métier** jamais dans DTO — dans `rules` service (ex: `max_amount`).

### 5.6 Gestion d'erreurs

- `HttpExceptionFilter` central → log structuré + audit si 4xx/5xx sensible.
- Codes métier `CREDIT_*`, `KYC_*`, `PAYMENT_*` documentés `docs/api.md`.
- Pas de fuite PII / stacktrace en prod.

### 5.7 Logs

- **Pino** JSON: `{level, time, requestId, userId, country, action, duration, ...}` — sans PII.
- **Audit** séparé (WORM). `LOG_LEVEL=info` prod, `debug` dev. **Sentry** pour exceptions.

### 5.8 Événements & Transactions

- **Transac DB:** `QueryRunner` TypeORM par use-case (`await queryRunner.startTransaction(); try{... commit} catch{rollback}`). Pas de 2PC distribué (monolithe).
- **Outbox** optionnelle: `events_outbox` table pour publier après commit → worker Bull dépile.
- **Queues BullMQ (Redis):** `kyc-verification` (5 retries exp), `scoring-calculate`, `document-scan`, `notification-send` (+ DLQ).

### 5.9 Cache

- **Redis** `ioredis`. Clés `countries:BE`, `products:BE:PERSONAL:v3`, `simulation:BE:PERSONAL:15000:48:3.99` TTL 60s. Invalidation `DEL` sur `SUPER_ADMIN` update.

### 5.10 Fichiers

- **S3 présigné** `PUT` 15m, **virus-scan** ClamAV queue, **OCR** Tesseract (async), métadonnées chiffrées, `GET` via signed URL 15m. Rétention `rules.retention_kyc_BE = 10y`.

### 5.11 Notifications

- **Orchestrateur** `NotificationsService` → `EmailService|SmsService|WhatsAppService|PushService` (ports). Templates Handlebars `i18n` (`fr` fallback `en`), préférences `customers.notification_prefs JSONB`, **queue** `notification-send` (retry 3, backoff). Preuve dans `audit`.

---

## 6. Synchrone vs Asynchrone

| Opération | Type | Pourquoi |
|-----------|------|----------|
| `simulation` | **Sync** | Pur, <50ms, cache, pas d'I/O lourd |
| `auth/login, refresh` | Sync | Doit répondre <200ms |
| `applications.create/submit` | Sync (write) + **async** (KYC/scoring) | Réponse 201 immédiate, traitements lourds en queue |
| `scoring` | **Async** | Règles + ratios, peut appeler providers |
| `kyc verification` | **Async** | Appel provider externe + liveness |
| `decision` (ADMIN) | Sync | Humain attend 201 + audit |
| `documents upload` | Sync (presign) + **async** (scan/OCR) | UX immédiate |
| `payments disburse` | **Async** (PSP) + webhook sync | PSP lent, idempotence |
| `notifications` | **Async** | Multi-canal, retry, pas bloquant |
| `audit` | Sync (écriture) mais append-only | Doit être dans transac |
| `reports/exports` | **Async** | Gros volumes |

**Règle:** tout ce qui touche un fournisseur externe ou >500ms = queue. Le reste = sync avec timeout 2s.

---

## 7. Arborescence complète implémentée (monolithe modulaire)

```txt
kredit/
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── [locale]/
│   │       ├── layout.tsx
│   │       ├── page.tsx              # landing Dewi
│   │       ├── (public)/             # alias → page.tsx sections
│   │       ├── dashboard/page.tsx    # (customer)
│   │       ├── admin/page.tsx        # (admin)  PENDING_REVIEW + dérogation
│   │       └── super/page.tsx        # (super)  config + audit
│   ├── components/
│   │   ├── ui/Button.tsx
│   │   ├── layout/Header.tsx
│   │   ├── layout/Footer.tsx
│   │   └── credit/Simulator.tsx
│   ├── features/                     # (nouveau, slice métier)
│   │   ├── auth/{LoginForm, useAuth, auth.schema.ts}
│   │   ├── credit-simulation/{Simulator, useSimulator, simulation.types.ts}
│   │   ├── credit-application/{ApplicationForm, Timeline, useApplications}
│   │   ├── kyc/{KycFlow, DocumentDropzone}
│   │   ├── repayments/{ScheduleTable, useRepayments}
│   │   └── administration/{Stats, UserTable}
│   ├── lib/{utils.ts, api.ts, pwa.ts, decimal.ts}
│   ├── hooks/{useAuth.ts, useLocale.ts, useDebounce.ts}
│   ├── services/
│   │   ├── api.client.ts             # fetcher JWT + idempotency
│   │   ├── simulation.service.ts
│   │   ├── applications.service.ts
│   │   └── documents.service.ts
│   ├── i18n/
│   │   ├── fr.json, en.json, nl.json, de.json
│   │   └── index.ts                  # t(locale,key)
│   ├── styles/{tokens.ts, dewi.css}
│   ├── types/{credit.ts, user.ts, api.ts}
│   ├── public/{manifest.json, sw.js, icons/}
│   ├── middleware.ts
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── dto/{login.dto, register.dto}
│   │   │   └── guards/jwt.guard.ts
│   │   ├── customers/
│   │   │   ├── customers.module.ts
│   │   │   ├── customers.controller.ts
│   │   │   └── customers.service.ts
│   │   ├── administrators/           # ADMIN + SUPER_ADMIN
│   │   │   ├── administrators.module.ts
│   │   │   └── administrators.service.ts
│   │   ├── countries/
│   │   │   ├── countries.module.ts
│   │   │   └── countries.service.ts
│   │   ├── kyc/
│   │   │   ├── kyc.module.ts
│   │   │   ├── kyc.service.ts
│   │   │   └── providers/{itsme.provider, onfido.provider, kyc.port.ts}
│   │   ├── credit/
│   │   │   ├── credit.module.ts      # agrégateur
│   │   │   ├── products/
│   │   │   │   ├── products.module.ts
│   │   │   │   ├── products.controller.ts
│   │   │   │   └── products.service.ts
│   │   │   ├── rules/
│   │   │   │   ├── rules.module.ts
│   │   │   │   └── rules.service.ts
│   │   │   ├── simulation/
│   │   │   │   ├── simulation.module.ts
│   │   │   │   ├── simulation.controller.ts
│   │   │   │   └── simulation.service.ts  # pur Decimal.js
│   │   │   ├── applications/
│   │   │   │   ├── applications.module.ts
│   │   │   │   ├── applications.controller.ts
│   │   │   │   └── applications.service.ts
│   │   │   ├── scoring/
│   │   │   │   ├── scoring.module.ts
│   │   │   │   └── scoring.service.ts
│   │   │   ├── decision-engine/
│   │   │   │   ├── decision-engine.service.ts  # recommend()
│   │   │   │   └── decision-engine.port.ts
│   │   │   ├── decisions/
│   │   │   │   ├── decisions.module.ts
│   │   │   │   └── decisions.service.ts   # decide() + exception
│   │   │   ├── schedules/
│   │   │   │   └── schedules.service.ts   # French amortisation
│   │   │   └── repayments/
│   │   │       ├── repayments.module.ts
│   │   │       └── repayments.service.ts
│   │   ├── investments/
│   │   │   ├── investments.module.ts
│   │   │   └── investments.service.ts
│   │   ├── payments/
│   │   │   ├── payments.module.ts
│   │   │   └── payments.service.ts
│   │   ├── documents/
│   │   │   ├── documents.module.ts
│   │   │   └── documents.service.ts
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.service.ts
│   │   │   └── channels/{email, sms, whatsapp, push}.service.ts
│   │   ├── administration/
│   │   │   ├── administration.module.ts
│   │   │   └── administration.service.ts
│   │   ├── audit/
│   │   │   ├── audit.module.ts
│   │   │   └── audit.service.ts        # hash-chaîné
│   │   ├── security/
│   │   │   ├── security.module.ts
│   │   │   └── security.service.ts
│   │   └── common/
│   │       ├── decorators/{roles, current-user, country}.ts
│   │       ├── guards/{roles.guard, country.guard}
│   │       ├── filters/http-exception.filter.ts
│   │       ├── interceptors/{audit.interceptor, logging.interceptor}
│   │       ├── pipes/validation.pipe.ts
│   │       └── utils/{crypto, decimal}.ts
│   └── package.json
├── database/
│   ├── migrations/1689000000_init.ts
│   ├── seeds/{001_countries_BE.ts, 002_products_BE.ts, 003_rules_BE.ts}
│   └── schema.sql
├── infrastructure/
│   ├── docker/{docker-compose.yml, Dockerfile.backend, Dockerfile.frontend}
│   ├── ci/github-actions.yml
│   ├── monitoring/{prometheus.yml, grafana.json, sentry.js}
│   └── backups/restore.sh
└── docs/
    ├── architecture.md
    ├── architecture-technique.md (ce fichier)
    ├── database.md
    ├── api.md
    └── adr/001-monolith-modular.md
```

---

## 8. Évolution future sans Big Bang

- **Extraire un module en service:** garder `Port` interface, remplacer `import {ScoringService}` par `HttpScoringAdapter implements ScoringPort` (appel `/api/v2/scoring`). Zéro changement feature.
- **Scaler indépendamment:** `scoring` et `kyc` sont déjà en queue → déployables sur workers séparés (BullMQ).
- **DB:** rester mono-Postgres (schémas `credit`, `kyc`) jusqu'à >50k dossiers/j; ensuite read-replica + RLS `country_code`.

---

## 9. Checklists MVP

- [ ] `countries BE` seed + `products` 3 types + `rules` versionnées + `validated_by_legal_at` null → bannière
- [ ] Simulation: test `amount=15000 term=48 → 338.84` + disclaimer i18n + PDF `SIMULATION` watermark
- [ ] State-machine tests (jest): `DRAFT→SUBMITTED→...→PENDING_REVIEW` bloque `AUTO_APPROVED`
- [ ] Audit: `prev_hash` chaîné, pas d'UPDATE grant, export WORM
- [ ] RBAC: e2e `CUSTOMER 403 /admin`, `ADMIN 403 /super`
- [ ] PWA Lighthouse 90+ (perf, PWA 100)

*Ce document prime sur toute implémentation et doit être mis à jour à chaque nouvelle règle métier (migration, pas code en dur).*
