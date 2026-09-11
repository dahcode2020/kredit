# KREDIT — Stratégie de tests complète

> Unit • Integration • API • E2E • Security • PWA • Accessibility — précision monétaire Decimal.js, Europe/Brussels, EUR, anti-floating errors.

---

## 0. Principes & pyramide

```
E2E (Playwright, 15-20 scénarios critiques, 4 locales)
  ↑
API (supertest, 60+ endpoints, RBAC, idempotence, webhooks)
  ↑
Integration (Nest Test + Testcontainers PG/Redis/Minio/S3 mock)
  ↑
Unit (Jest, 300+ tests, 90% domaine crédit/scoring)
```

- **Fail fast** : unit <2s, integration <30s, API <60s, E2E <5m.
- **Isolation** : chaque test crée ses données, `afterEach` drop, `idempotencyKey` UUID v4 aléatoire.
- **Déterministe** : `Decimal` pas `float`, `timezone: Europe/Brussels`, `currency: EUR`, `locale` paramétré, snapshot figés `2026-01-01`.
- **CI** : GitHub Actions `lint → unit → integration (pg,redis) → api → build → e2e → security → pwa → a11y → coverage 80%` (domaine 90%).

---

## 1. Précision & arrondi monétaire

**Module** `backend/src/common/money/money.ts` (source de vérité)

- **Source** : `Decimal.js` `precision 28, rounding HALF_UP` — jamais `number + - * /` ni `Math.pow` float
- **Échelle** : `NUMERIC(15,2)` DB ↔ `Decimal` JS ↔ `number` arrondi 2 décimales uniquement en bordure (DTO)
- **Règles** :

| Opération | Formule Decimal | Arrondi | Exemple |
|-----------|----------------|---------|---------|
| **Mensualité** | `P * r / (1 - (1+r)^-n)` | `toDecimalPlaces(2, HALF_UP)` | 15 000€ 48m 3,99% → 338,62€ (±1c) |
| **Intérêt mois i** | `balance * r` | `2 HALF_UP` |  |
| **Principal** | `monthly - interest` | `min(principal, balance)` puis `HALF_UP` |  |
| **Balance** | `balance - principal` | `HALF_UP`, dernier mois forcé 0 (ajusté) |  |
| **Total coût** | `monthly*n + fees` | `HALF_UP`, fees cap 10% principal |  |
| **Somme** | `sumEuro: reduce Decimal` | final `HALF_UP` | évite 0.1+0.2≠0.3 |
| **Conversion** | `toCents(euro*100)` | `0 HALF_UP` | 338,62 → 33862c |
| **TimeZone** | `Europe/Brussels` 12:00 10e jour | `Intl.DateTimeFormat` |  |
| **Devise** | `EUR` only, `Intl.NumberFormat fr-BE/nl-BE/de-BE/en-BE` |  |  |

**Interdits CI-lint** : `no-restricted-syntax: float ops sur montant` (grep `amount * `), `no-magic-float`.

**Invariants testés** :

```ts
expect(schedule.length).toBe(n);
expect(sum(schedule.map(s=>s.principal))).toBeCloseTo(principal, 2); // 1c
expect(schedule.at(-1)!.balance).toBe(0);
expect(schedule.every(s=> round(s.interest+s.principal)===round(monthly) || isLast)).toBe(true);
expect(totalCost).toBe(round(monthly*n+fees));
```

---

## 2. Unit tests (Jest `backend` — `src/**/@@tests` & `tests/unit`)

**Env** : `ts-jest, testEnvironment node, roots <rootDir>/src, <rootDir>/tests`

**Couverture** : `branches 80, functions 85, lines 90` sur `simulation, eligibility, scoring, decision, rules, money`.

**Fichiers** :

- `tests/unit/money.rounding.spec.ts` — HALF_UP 1.005→1.01, sum 0.1+0.2=0.3, toCents, add/sub
- `tests/unit/simulation.precision.spec.ts` — mensualités 15k/48m/3.99% 338.62, 0% 416.67, mortgage 300m, cap fees 10%
- `tests/unit/eligibility.spec.ts` — debtRatio, max_debt_ratio soft 33% vs hard 55%, charges>90% hard
- `tests/unit/scoring.spec.ts` — grades A-E, weights configurable, debt 38% → C, UNEMPLOYMENT → E
- `tests/unit/rules.spec.ts` — getRateRule bandes 1500-50000, effectiveFrom, versioning
- `tests/unit/decision.spec.ts` — APPROVE/REVIEW/REJECT matrix
- `tests/unit/permissions.spec.ts` — RolesGuard, RequireMFA, ADMIN>50k→SUPER_ADMIN
- `tests/unit/kyc.spec.ts` — AdminManualProvider, mock-aml, fraud velocity
- `tests/unit/payment.idempotency.spec.ts` — même key → même Payment, 409 si payload diff
- `frontend/tests/unit/pwa-cache.test.ts` — strategies STATIC/PUBLIC/AUTH/FINANCIAL non-cache

**Frontend — `frontend/jest.config.js`** (`ts-jest`, `testEnvironment: jsdom`). Le fuseau du
processus est épinglé à `Europe/Brussels` par `tests/global-setup.js` — pas par `process.env.TZ`
dans `setupFilesAfterEnv` : posé après le démarrage du worker, il ne rejoint pas l'analyseur
de dates de V8, et un CI en UTC laisserait passer un parse « à la locale du runtime ».

- `tests/unit/amortize.precision.spec.ts` — mensualités Decimal HALF_UP, solde final forcé à 0
- `tests/unit/i18n.money.spec.ts` — `formatEUR`/`formatEUR2` fr-BE / en-BE / nl-BE
- `tests/unit/hydration.spec.ts` — **verrous anti-hydratation** : sorties Intl sans espace
  non normalisé, identité U+202F ↔ U+00A0 (CLDR simulé), dates à fuseau forcé, et hiérarchie de
  détection de locale (`lib/locale-detection.ts`) partagée avec le middleware
- `tests/unit/dates-timezone.spec.tsx` — `resolveDate` (parité chaîne naive / ISO, « jour seul »,
  valeur invalide → chaîne vide et non `RangeError`), pureté de `relativeTime` (échoue dès que
  l'horloge est lue au calcul), et **hydratation** de `<RelativeTime>` : `renderToString` →
  `hydrateRoot` en écoutant `console.error` + `onRecoverableError`
- `tests/pwa/cache-strategies.spec.ts` — stratégies déclaratives + manifest
- `tests/a11y/axe.spec.ts` — invariants a11y statiques (landmarks, palette)
- garde-fous hors Jest : `npm run check:hydration` (APIs au render + imbrications HTML) et
  `npm run check:hydrate` (hydratation réelle via jsdom, option `--skew-intl`)
- `frontend/tests/unit/i18n.test.ts` — t('fr', 'hero.title') + fr-BE override

**Commande** : `npm run test:unit` → `jest --testPathPattern='tests/unit|__tests__' --coverage`

---

## 3. Integration tests (Nest Test + Testcontainers)

**Stack** : `@nestjs/testing, testcontainers (postgres:15, redis:7, minio), bullmq mock`

**Fichiers** `tests/integration/*.spec.ts` :

- `application.workflow.spec.ts` — transitions DRAFT→SUBMITTED (CUSTOMER ok), DRAFT→UNDER_ADMIN_REVIEW forbidden, UNDER_AUTOMATED_REVIEW nécessite KYC_PENDING+DOCUMENTS_PENDING, APPROVED_WITH_EXCEPTION 20-2000 chars + >50k SUPER_ADMIN, REJECTED terminal
- `kyc.flow.spec.ts` — NOT_STARTED→IN_REVIEW→VERIFIED par ADMIN MFA, REJECTED→IN_REVIEW
- `documents.integration.spec.ts` — presign 15m, upload 10MB, ClamAV, MIME whitelist, S3 SSE-KMS, SHA256, scan INFECTED→REJECTED
- `payment.integration.spec.ts` — create idempotent, provider Mollie retry 3×, webhook paid → SUCCEEDED, adminConfirm
- `notifications.integration.spec.ts` — templates i18n 4×4, outbox idempotency, BullMQ retry
- `audit.integration.spec.ts` — hash chaîné append-only, UPDATE/DELETE forbidden, correlation query

**Setup** :

```ts
beforeAll(async () => {
  const pg = await new PostgreSqlContainer().start();
  process.env.DATABASE_URL = pg.getConnectionUri();
  const app = await Test.createTestingModule({ imports:[AppModule] }).compile();
  await app.init();
});
afterEach(async () => { await dataSource.query('TRUNCATE audit_logs, applications CASCADE'); });
```

**Commande** : `npm run test:integration` — 30s

---

## 4. API tests (supertest)

**Fichiers** `tests/api/*.spec.ts` :

- `auth.api.spec.ts` — register 201/409, login lockout 5→423 15m, refresh rotation, MFA 42
- `customer.api.spec.ts` — GET/PUT profile, validation forbidNonWhitelisted →422, X-Request-Id propagé
- `credit.api.spec.ts` — POST /credit/simulations (sans auth) 201 + disclaimer, GET /simulations/:id, POST /applications idempotent 201/200 même key 409 diff, PUT draft, POST documents multipart 413/415, GET status/schedule
- `investments.api.spec.ts` — catalogue filtré, souscription checks KYC/suitability →403 si non vérifié, idempotence
- `payments.api.spec.ts` — POST /payments idempotency, jamais SUCCEEDED sans webhook, double webhook idempotent, refund
- `admin.api.spec.ts` — GET /admin/dashboard 403 si CUSTOMER, 403 si ADMIN sans MFA, approve 200, approve-with-exception 403 si ADMIN>50k, reject, audit logs
- `audit.api.spec.ts` — GET /admin/audit-logs?correlation_id=req_abc → investigation, verifyChain

**Exemple** :

```ts
const res = await request(app.getHttpServer())
  .post('/api/v1/credit/simulations')
  .send({ amount:15000, termMonths:48, monthlyIncome:3200, monthlyCharges:900, incomeType:'SALARY', employmentStatus:'CDI', loanPurpose:'VEHICLE', country:'BE' })
  .expect(201);
expect(res.body.simulation.monthlyPayment).toBeCloseTo(338.62, 0);
expect(res.body.simulation.taeg).toBeDefined();
expect(res.body.warnings).toEqual(expect.any(Array));
```

**Rate & headers** : `X-Request-Id` écho, `X-RateLimit-Limit`, `429` after 100/min.

**Commande** : `npm run test:api`

---

## 5. E2E tests (Playwright)

**Config** `playwright.config.ts` : `projects: [{name:'chromium', use:{...devices['Desktop Chrome']}}, {name:'Mobile Chrome'}], webServer: {command:'npm start', port:3000}`

**Fichiers** `tests/e2e/*.spec.ts` :

- `01-landing.*.spec.ts` — 4 locales `/fr /en /nl /de` titre, hero, stats, simulateur visible, footer disclaimer, SEO `<title>`+`og:image`
- `02-simulator.spec.ts` — déplace sliders 15k→30k, 48m→60m, vérif mensualité recalcul Decimal, disclaimer, CTA
- `03-language.spec.ts` — switch FR→NL via Header, URL `/nl`, cookie `NEXT_LOCALE`, API PATCH `/customers/me/preferences` mock, i18n t('nl','hero.title')
- `04-credit-flow.spec.ts` — register→login→create application DRAFT→edit→submit→upload doc (fake pdf) → status KYC_PENDING → admin approve (mock ADMIN) → échéancier français 48 lignes, balance 0
- `05-permissions.*.spec.ts` — CUSTOMER cannot GET /admin/dashboard →403, ADMIN sans MFA →403 MFA_REQUIRED
- `06-offline.spec.ts` — PWA offline: `page.route('**\/api\/v1/**', route=>route.abort())` → banner `Hors ligne — données financières non disponibles`, simulateur local OK (338.62), création dossier → `503 OFFLINE` + `ServerRequiredNotice`
- `07-investments.spec.ts` — catalogue, souscription blocked si KYC non vérifié → 403 suitability, puis après KYC → subscribed

**Helpers** : `helpers/auth.ts` login(), `helpers/i18n.ts` expectLocale(), `helpers/pwa.ts` waitForServiceWorker().

**Timezone** : `test.use({ timezoneId:'Europe/Brussels' })`, dates affichées via `Intl.DateTimeFormat('fr-BE')` — vs `en-BE` diff.

**Commande** : `npx playwright test` — 5m, `npx playwright test --project="Mobile Chrome"` pour responsive.

---

## 6. Security tests (`tests/security`)

- `bruteforce.spec.ts` — 5 fails login même email → 6e →423 + `security_logs BRUTE_FORCE CRITICAL` + alertAdmins email
- `rateLimit.spec.ts` — 101 req/min même IP → 429, `Retry-After`
- `rbac.spec.ts` — CUSTOMER POST /admin/rules →403, ADMIN PUT /admin/rules/:id →200 mais POST /admin/administrators →403 (SUPER_ADMIN only), ADMIN approve >50k exception →403 REQUIRES_SUPER_ADMIN
- `xss.spec.ts` — payload `<script>alert(1)</script>` dans `reason` → sanitized, `ValidationPipe forbidNonWhitelisted`
- `auditRedaction.spec.ts` — `audit_logs.before` ne contient jamais `password, secret, niss` en clair → `[REDACTED]`
- `mfa.spec.ts` — ADMIN sans `mfa_verified_at` GET /admin/dashboard →403 MFA_REQUIRED, avec totp →200
- `hashChain.spec.ts` — après INSERT audit, `verifyChain() valid:true`, après UPDATE tentative → exception, après DELETE → exception (trigger)
- `secrets.spec.ts` — env `.env` ignoré git, `JWT_SECRET` rotate 90j → old `jti` déni

**Outils** : `zap` (OWASP) baseline en CI, `npm audit`, `helmet` headers `HSTS/CSP` vérifiés `expect(res.headers['strict-transport-security']).toContain('max-age')`

---

## 7. PWA tests (`frontend/tests/pwa`, `playwright`)

- **Manifest** : `fetch('/manifest.json')` → `name, short_name, display:standalone, icons 512 maskable, screenshots wide/narrow, shortcuts 3`
- **Service Worker** : `navigator.serviceWorker.controller !== null` après `load`, `caches.keys()` contient `kredit-static-v2, kredit-public-v2, kredit-offline-v2`, stratégies: `fetch('/_next/static/...')` → `CacheFirst` (200 from cache second hit), `fetch('/api/v1/investment-products')` → `StaleWhileRevalidate`, `fetch('/api/v1/payments', {method:'POST'})` → `NetworkOnly` (offline→503 `X-KREDIT-Offline:1`), `fetch('/fr/dashboard')` offline → `caches.match('/fr/offline')`
- **Offline fallback** : `await context.setOffline(true)` → `page.goto('/fr/dashboard')` → `await expect(page.locator('text=Hors ligne')).toBeVisible()` + banner rouge, simulateur shell 338.62 toujours visible (calcul local)
- **Install prompt** : `page.evaluate(()=>window.dispatchEvent(new Event('beforeinstallprompt')))` → `InstallPrompt` banner visible → click Installer → `deferred.prompt` mock
- **Update** : `page.evaluate(()=>navigator.serviceWorker.controller.postMessage({type:'SKIP_WAITING'}))` → toast `Mise à jour disponible`
- **Push** : `serviceWorkerEvaluation: registration.pushManager.subscribe` → `Notification.permission === 'granted'`
- **Headers** : `GET /sw.js` → `Cache-Control: max-age=0, must-revalidate + Service-Worker-Allowed:/`, `GET /manifest.json` → `max-age=0`

**Commande** : `npm run test:pwa` → `jest frontend/tests/pwa` + `playwright --grep @pwa`

---

## 8. Accessibility tests (`frontend/tests/a11y`)

- **Outil** : `axe-core` (`@axe-core/playwright`) + `lighthouse --only-categories=accessibility`
- **Scénarios** : landing `/fr`, simulateur, dashboard, admin, offline

```ts
import AxeBuilder from '@axe-core/playwright';
test('landing a11y', async ({page}) => {
  await page.goto('/fr');
  const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
```

- **Checks** : `landmark (header/main/footer/nav)`, `skip-link` focusable, `aria-live` connectivity `ONLINE/OFFLINE`, `alt` icons, contrast AA (ink #0F1115/white, primary #FF4A17), `keyboard` Tab → focus `ring-primary`, `prefers-reduced-motion`, `lang` per locale `fr-BE`

**Seuil** : `0 violations`, Lighthouse a11y >95, `eslint-plugin-jsx-a11y` en CI.

---

## 9. Cas limites (matrice)

| Cas | Entrée | Attendu | Test |
|-----|--------|---------|------|
| **Min amount** | 1 500€ PERSONAL 12m | 201 (bande 1500-10000) mensualité ≈128,99€ | unit |
| **Max amount** | 50 000€ PERSONAL 84m | 201 | unit |
| **>Max** | 50 001€ PERSONAL 48m | 400 NO_RATE_RULE | unit |
| **Min term** | 12m 15k | mensualité 1 276€ (taeg 3,99%) | unit |
| **Max term** | 300m MORTGAGE 200k 3,25% | mens ≈ 870€ schedule 300 | unit |
| **Revenus nuls** | 0€ | `debtRatio Infinity` → hardFail `charges_vs_income` → REJECT | unit/eligibility |
| **Charges > revenus** | 3000 vs 3200 + 900 charges +250 crédits +338 mens → cap >90% → hard REJECT | unit |
| **Demande incomplète** | `without termMonths` → 422 Validation `forbidNonWhitelisted` | api |
| **Doc expiré** | `expires_at < now` → `EXPIRED` → KYC bloqué | integration kyc |
| **KYC échoué** | Admin REJECT + motif → `KYC_PENDING→REJECTED` → application bloquée | integration workflow |
| **Paiement échoué** | Mollie 500 retry 3× → FAILED → retry adminConfirm → SUCCEEDED | payment integration |
| **Webhook ×2** | même `provider_payment_id` POST twice → idempotent `findByProviderId` → second → 200 already SUCCEEDED | api payments |
| **Double soumission** | même `X-Idempotency-Key` POST /applications → 200 même id (hit mem) | api |
| **Admin non autorisé** | CUSTOMER `POST /admin/rules` →403, ADMIN without MFA →403 | security/api |
| **Modif simultanée** | 2 PUT /applications/:id avec `If-Match` version 1 → second →409 Conflict (optimistic lock) | integration workflow |
| **Arrondi** | 0.1+0.2 vs Decimal 0.3 → `equalsEuro(0.3, sumEuro([0.1,0.2])) true`, float false | unit rounding |
| **Timezone** | `dueDateBrussels(1)` 10e jour 12:00 Brussels → UTC `+1/+2` OK | unit |
| **Devise** | `currency≠EUR` →422, `formatEUR` `fr-BE 1 234,56 €` vs `en-BE €1,234.56` | unit |
| **Multilingue** | `GET /en` → `<html lang=en>` + `t('en','hero.title')` | e2e language |
| **Changement langue** | Header click NL → URL `/nl` + cookie `NEXT_LOCALE=nl` + `localStorage kredit-install-dismissed` | e2e |

---

## 10. CI

```yaml
- run: npm run lint -- --max-warnings=0
- run: npm run test:unit -- --coverage --coverageReporters=text
- run: npm run test:integration -- --runInBand (testcontainers)
- run: npm run test:api -- --runInBand
- run: npm run build -- (NEXT, NEST)
- run: npx playwright test --reporter=html
- run: npm run test:security -- --testPathPattern=security
- run: npm run test:pwa -- --testPathPattern=pwa
- run: npm run test:a11y -- axe
- uses: codecov/codecov-action@v4
```

**Seuils** : global 80%, `backend/src/credit` 90%, `money` 100%.

---

## 11. Commandes

```bash
npm run test           # all jest
npm run test:unit
npm run test:integration
npm run test:api
npm run test:e2e       # playwright
npm run test:security
npm run test:pwa
npm run test:a11y
npm run test:cov        # coverage
```

---

## 12. Fichiers

```
backend/jest.config.js (unit)
backend/jest.integration.config.js
backend/jest.api.config.js
backend/src/common/money/money.ts
backend/tests/unit/*.spec.ts (≈15 fichiers)
backend/tests/integration/*.spec.ts
backend/tests/api/*.spec.ts
backend/tests/security/*.spec.ts
frontend/jest.config.js
frontend/tests/unit/*.spec.tsx
frontend/tests/pwa/*.spec.ts
frontend/tests/a11y/*.spec.ts
tests/e2e/*.spec.ts (playwright)
playwright.config.ts
docs/tests.md
```

> **Golden rule** : aucun `Number` float ne touche un montant — `Decimal` + `roundEuro` + `NUMERIC(15,2)` — faute → test rouge.
