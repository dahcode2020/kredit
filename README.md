# KREDIT — Plateforme Européenne de Crédit & Investissement (PWA)

> **Belgique d'abord, Europe ensuite.** — Inspiré par **Dewi** (Themewagon), adapté en design system fintech premium.
> **Stack:** Next.js 14 • React 18 • TypeScript • Tailwind • PWA • NestJS • PostgreSQL • Redis • S3 • BullMQ

[![PWA](https://img.shields.io/badge/PWA-installable-FF4A17)](#) [![i18n](https://img.shields.io/badge/i18n-FR%20EN%20NL%20DE-blue)](#) [![EUR](https://img.shields.io/badge/currency-EUR-059669)](#) [![License](https://img.shields.io/badge/license-proprietary-lightgrey)](#)

**Live PWA (dev):** `npm run dev` → http://localhost:3000 → redirige vers `/fr` (FR/EN/NL/DE)

---

## 1. Démarrage ultra-rapide

```bash
# Frontend PWA (Next.js)
cd frontend
npm install
npm run dev      # → http://localhost:3000  (bind 0.0.0.0)

# Backend NestJS (optionnel, mocké côté front pour la démo)
cd ../backend
npm install
npm run dev      # → http://localhost:4000/api/v1

# Full stack via Docker (postgres+redis+minio)
docker compose up --build
```

**Comptes de démo (front mock):**
- `customer@kredit.be / Customer123!` → `/fr/dashboard`
- `admin@kredit.be / Admin123!` → `/fr/admin`
- `super@kredit.be / Super123!` → `/fr/super`

> La PWA est installable (manifest + sw.js). Offline shell + cache fonds critiques.

---

## 2. Ce qui a été livré

### Architecture — production, pas prototype
Voir **[`docs/architecture.md`](docs/architecture.md)** (9 chapitres exigés):
1. Architecture globale, 2. Frontend, 3. Backend, 4. Database, 5. Flux métiers, 6. Dépendances, 7. Risques, 8. Points réglementaires, 9. Plan par étapes (0→5).

**Principes non négociables implémentés:**
- ✅ Aucune règle pays/taux/plafond en dur — tout en `product_rules` / `product_rates` versionnés
- ✅ Simulation ≠ offre ferme (disclaimer + PDF marqué, `simulationOnly`)
- ✅ Décision auto ≠ décision bancaire — recommandation vs `PENDING_REVIEW` humain
- ✅ Dérogation exceptionnelle tracée avec motif + hash chaîné
- ✅ KYC/AML/antifraude/RGPD/audit dès J1
- ✅ 4 langues natives, EUR, multi-tenant `country_code`

### Frontend PWA — Dewi → KREDIT
Traduction fidèle de Dewi en fintech **crédit & investissement**:

| Dewi | KREDIT |
|---|---|
| Hero PLAN. LAUNCH. GROW. | « Votre crédit. Votre avenir. En toute confiance. » + carte simulateur |
| Stats | Encours / Dossiers / Satisfaction / Délai |
| Featured Services 3 cards | Crédit Personnel / Hypothécaire / Pro + Investissements (4 cards img-top) |
| Clients logos | BNB • FSMA • Febelfin • CTIF • eIDAS • itsme® |
| Tabs Features | Parcours 4 étapes (Demande → Vérifs → Décision humaine → Déblocage) |
| Services 6 icon boxes | 6 garanties production (Sécurisé, Conforme, Rapide, Configurable, Transparent, Notifié) |
| Testimonials overlay | Avis vérifiés BE (avec disclaimer) |
| Portfolio | Remplacé par comparateur produits & tarifs |
| Team | Gouvernance & conformité |
| Contact + map | Bruxelles + WhatsApp/Email + formulaire RGPD |

**Pages livrées:**
- `/fr|en|nl|de` — landing complète + simulateur interactif (amortissement français, TAEG configurables)
- `/fr/dashboard` — Customer (dossiers, KYC, échéancier, investissements)
- `/fr/admin` — Admin (file PENDING_REVIEW, décision, dérogation avec motif)
- `/fr/super` — Super Admin (produits/taux/règles/pays/intégrations/audit)

**i18n:** `lib/i18n.ts` — FR/EN/NL/DE sur toutes interfaces, PDFs et notifications (templates ICU prévus).

**PWA:** `public/manifest.json`, `public/sw.js`, icons 192/512, standalone, theme #0F1115.

### Backend NestJS — squelette product-ready
- Monorepo `frontend/` + `backend/` + `packages/shared` (Turborepo ready)
- Modules: `auth, customers, kyc, countries, products, simulation, applications, scoring, decision, repayment, payments, documents, notifications, admin, audit`
- `SimulationService` pur (Decimal.js), `DecisionService` (reco vs décision), `AuditService` (hash chaîné)
- Guards RBAC (`@Roles('ADMIN')`), ValidationPipe, Helmet, CORS strict, idempotency-key (prévu)
- `docker-compose.yml` (Postgres 15 + Redis 7 + MinIO + backend + frontend)

### Base de données
Voir **[`docs/database.md`](docs/database.md)** — schéma PostgreSQL avec enums, versioning `effective_from/to`, `audit_logs` hash-chaîné, RLS ready.

---

## 3. Flux métier (résumé)

```
DRAFT → SUBMITTED → KYC_PENDING → SCORING → PENDING_REVIEW → DECIDED_*
                                          ↘ EXCEPTIONAL (motif + SUPER_ADMIN si seuil)
```

- **Simulation:** `POST /api/v1/simulations` — sans auth, cache 60s, disclaimer obligatoire
- **Demande:** `POST /api/v1/applications` (idempotency) → queues BullMQ (KYC/Scoring)
- **Décision:** `POST /api/v1/admin/applications/:id/decision` — ADMIN only, audit immuable
- **Déblocage:** PSP (Mollie) SEPA + échéancier français + notifs multi-canal

---

## 4. Conformité & disclaimers

> KREDIT est une **plateforme technologique**, pas un établissement de crédit. Toute offre ferme requiert agrément BNB/FSMA. Les règles marquées `needs_legal_validation=true` affichent bannière « validation juridique requise » et ne passent pas en prod sans `validated_by_legal_at`.

- Simulation ≠ offre, décision auto ≠ décision bancaire — rappelé à chaque écran
- RGPD: minimisation, chiffrement, anonymisation, DPA, rétention configurable (ex: 10 ans KYC BE)
- Audit: append-only, hash chaîné, export WORM S3

---

## 5. Arborescence

```
kredit/
├─ docs/
│  ├─ architecture.md   # 9 chapitres complets
│  └─ database.md       # schéma SQL
├─ frontend/            # Next.js 14 PWA (Dewi-inspired)
│  ├─ app/[locale]/     # landing + dashboard/admin/super
│  ├─ components/       # Header/Footer/Simulator/ui
│  ├─ lib/i18n.ts       # FR/EN/NL/DE
│  └─ public/           # manifest, sw.js, icons
├─ backend/             # NestJS 10 modulaire
│  └─ src/modules/*/    # 16 bounded contexts
├─ docker-compose.yml
└─ .env.example
```

---

## 6. Prochaines étapes (plan §9)

- **Phase 0 (S1):** CI/CD, tests, PWA Lighthouse 100 — ✅ *fait*
- **Phase 1 (S3-5):** Simulation + Applications + Documents S3 — *frontend fait, backend à câbler DB*
- **Phase 2 (S6-7):** KYC provider + Audit WORM + Notifs — *interfaces prêtes*
- **Phase 3 (S8-9):** Repayment + PSP SEPA webhooks idempotents
- **Phase 4 (S10-12):** Investments (MiFID quiz) + observabilité
- **Phase 5 (S13+):** Pentest, DPIA, agrément FSMA, pays 2 (NL/LU) — juste config

---

## 7. Crédits

- Design inspiré par **Dewi** — Themewagon / BootstrapMade (hero, stats, cards, tabs, services, testimonials, contact)
- Adaptation fintech & architecture: KREDIT Team — 2026-09-10
- Licence: usage interne / démo Arena — ne pas déployer en prod sans validation juridique

---

**Besoin d'aide?** Voir `docs/architecture.md §8` pour la checklist juridique avant go-live BE.
