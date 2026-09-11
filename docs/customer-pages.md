# KREDIT — Espace Client : Spécification UI (14 pages)

> Fintech rassurante, Dewi-inspired (dark ink + primary #FF4A17), mobile-first, accessible (AA), PWA installable. Toutes pages `/[locale]/*` avec `CustomerShell` (sidebar desktop + bottom nav mobile).

## Principes transverses

* **Stack:** Next.js 14 App Router (client components avec `useState` mock + `Suspense`), Tailwind, `lib/credit-engine`, `hooks/useAuth`, `services/api.client`.
* **Layout `CustomerShell`:** 
  - Desktop 1280: sidebar 260px fixed (logo KREDIT., nav 14 liens, app status, user mini-card, `APPROVED_WITH_EXCEPTION` badge si besoin).
  - Mobile: header 56px + bottom nav 4 icônes (Dashboard, Crédit, Docs, Profil) + drawer hamburger.
  - Header: breadcrumb, locale switcher `FR/EN/NL/DE`, notif bell (badge 3), avatar. `EUR • BE` pill.
* **États systématiques:** `loading` (skeleton shimmer), `empty` (illustration + CTA), `error` (retry + requestId), `success` (toast vert, audit).
* **Accessibilité:** focus rouge, `aria-live` pour toasts, `prefers-reduced-motion`, contrast AA, tap 44px.
* **PWA:** chaque page `export const dynamic = 'force-static'` + `sw.js` cache shell, offline fallback `dashboard`.
* **Validations:** Zod + RHF, messages i18n, inline error + `aria-invalid`.

---

## 1. `/dashboard` — Résumé financier

**Composants:** `StatGrid (3 cards: Encours, Prochaine échéance, Capacité)`, `ApplicationsList (3)`, `ActiveLoansTable`, `NextPaymentCard`, `InvestmentsMini`, `NotificationsList (3)`, `DocumentsCard`, `Shortcuts (4 CTA)`.

* Champs: — (lecture)
* Actions: `Voir dossier` → `/credit/applications/[id]`, `Reprendre DRAFT` → `/credit/applications/[id]`, `Nouvelle simulation` → `/credit/simulator`, `Payer maintenant` → `/payments`.
* Loading: skeleton 3 cards + shimmer list. Empty: “Aucune demande — Simuler” illustration. Error: retry + `x-request-id`.
* Responsive: mobile 1 col, tablet 2, desktop 3. Cards 16px radius, shadow-soft.

## 2. `/profile` — Informations personnelles

**Champs:** `firstName*`, `lastName*`, `birthDate*` (≥18 hard), `nationality*` (select), `address*` (BeSt autocomplete), `niss` (hash, masqué `***123`), `phone*` (E.164), `email` (readOnly + `Vérifié`), `locale*`.

* Validations: Zod `firstName min2`, `birthDate age≥18`, `niss regex BE`, `phone +32`, `address required`. Inline error.
* Actions: `Enregistrer` (PUT /customers/me) → toast success + audit, `Annuler` reset.
* États: loading form skeleton, success toast “Profil mis à jour”, error field highlight.
* Responsive: form 2 col desktop, 1 col mobile. Sticky save bar mobile.

## 3. `/security`

**Sections:** `Mot de passe` (old + new + confirm, règles 12 chars), `2FA TOTP` (QR + code 6), `Sessions` (table device/ip/last), `Déconnexion partout`.

* Validations: `new ≠ old`, `confirm==new`, `2FA code 6 digits`.
* Actions: `Changer mdp` → re-auth, `Activer 2FA`, `Révoquer session`.
* Empty: “Aucune session autre”. Error: `SESSION_REVOKED`.

## 4. `/credit` — Hub crédit

**Composants:** `ProductGrid (3)`, `SimulatorTeaser`, `ApplicationsCTA`, `DocsChecklist`.

* Actions: `Simuler` → `/credit/simulator`, `Mes demandes` → `/credit/applications`.

## 5. `/credit/simulator` — Simulateur 8 champs (moteur complet)

**Déjà livré** (`components/credit/Simulator.tsx` refondu 8 champs). Champs: amount, term, monthlyIncome, monthlyCharges, incomeType, employmentStatus, loanPurpose, existingCreditsMonthly. Affichage `simulation/taeg/debt/score/reco/warnings/docs` + échéancier 12. **Aucun champ en dur, RateRule BE config.**

* Validation: Zod 8 champs (voir `SimulateDto`). `existing` peut être 0.
* Actions: `Déposer ma demande` → crée `DRAFT` + `POST /credit/applications` + redirect `/credit/applications/[id]`.
* États: `NO_RATE_RULE` banner rouge, `AT_CEILING` amber.

## 6. `/credit/applications` — Liste demandes

**Filtres:** `status` (chips 16), `search` (id), `sort` (date/montant). **List:** `ApplicationCard` (id mono, produit, montant, mensualité, `status` chip color, debt, score, date).

* Actions: `Filtrer`, `Voir`, `Reprendre DRAFT` (owner), `Annuler DRAFT` (CANCELLED).
* Empty: “Aucune demande — Simuler” + illustration. Loading: skeleton 3 cards.

## 7. `/credit/applications/[id]` — Détail + suivi dossier

**Sections:** `Header` (id + status chip + amount), `Timeline` (17 étapes + `credit_application_status_history`), `SimulationSnapshot` (readOnly), `DecisionCard` (reco vs décision, `exceptionReason` banner amber si `APPROVED_WITH_EXCEPTION`), `DocumentsList` (upload), `Schedule` (table amortissement), `Actions` (selon statut: `Soumettre` si DRAFT, `Signer contrat` si CONTRACT_PENDING, `Payer` si DISBURSED).

* Actions guardées par `ApplicationWorkflowService` (ex: `DRAFT→SUBMITTED` seulement CUSTOMER).
* États: loading timeline skeleton, error `TRANSITION_NOT_ALLOWED` toast.

## 8. `/credit/documents`

**Composants:** `Dropzone` (S3 présigné, progress, `accept .pdf .jpg`), `DocTable` (code, label, status `VERIFIED/PENDING/REJECTED`, virusScan, uploadedAt).

* Validations: `≤10MB`, `pdf/jpg/png`, `required docs` check via `RulesService`.
* Actions: `Obtenir URL présignée` → PUT S3 → `document.uploaded` event, `Voir` (signed URL 15m), `Supprimer` (soft si DRAFT).
* Empty: “Aucun document — déposez ID”. Error: `VIRUS_DETECTED` quarantaine.

## 9. `/credit/repayments` — Échéanciers

**Table:** `N lignes` (mois, échéance, intérêts, capital, restant, statut `PAID/PENDING/LATE`), `NextPaymentCard` (date, montant, IBAN), `Progress` (payé/total).

* Actions: `Télécharger PDF` (échéancier), `Payer en avance` (si DISBURSED).
* Empty: “Aucun crédit décaissé”. Loading: skeleton table.

## 10. `/investments` — Portefeuille

**Sections:** `PortfolioSummary` (total, +/-, risk), `HoldingsTable` (BE Green Bond 2031 risk3), `Catalogue` (3 produits), `Quiz` (MiFID).

* Actions: `Voir` → `/investments/[id]`, `Simuler investissement` (non crédit).

## 11. `/investments/[id]` — Détail

**Fiche:** `risk 1-7`, `prospectus`, `PRIIPs`, `quiz adéquation`. Disclaimer perte capital.

## 12. `/payments` — Paiements & mandats SEPA

**Table:** `pspRef, amount, status PENDING/CONFIRMED/FAILED, date, method SEPA, receipt`. `Mandats` (IBAN, `mandateRef`).

* Actions: `Voir reçu` (PDF), `Réessayer` (si FAILED).
* Empty: “Aucun paiement”.

## 13. `/notifications` — Centre notifs

**List:** `Email/SMS/WhatsApp/Push` avec `templateKey`, `locale`, `read`, `payload`. **Prefs:** toggles par canal.

* Actions: `Marquer lu`, `Préférences` → `PUT /customers/me/notifications`.
* Empty: “Aucune notification”.

## 14. `/settings` — Préférences

**Champs:** `locale` (FR/EN/NL/DE radio), `currency EUR` (readOnly), `notifications` (4 toggles), `consentVersion` (historique), `Delete account` (anonymisation RGPD).

* Validations: locale in `['fr','en','nl','de']`.
* Actions: `Enregistrer` → toast, `Exporter données` (GDPR JSON), `Supprimer` (confirm OTP).

---

## Responsive & nav

* `CustomerShell` gère `sidebar` (240) desktop, `bottom-nav` mobile (4 items), `drawer` pour 14 liens.
* Chaque page `grid` 12 cols: mobile 1 col, `md:2`, `lg:3-4`.
* `loading.tsx` par dossier (skeleton), `error.tsx` (retry + `requestId`), `not-found.tsx`.

## Arborescence Next.js

```
app/[locale]/
├── layout.tsx (root Dewi)
├── page.tsx (landing)
├── dashboard/page.tsx
├── profile/page.tsx
├── security/page.tsx
├── credit/page.tsx
├── credit/simulator/page.tsx
├── credit/applications/page.tsx
├── credit/applications/[id]/page.tsx
├── credit/documents/page.tsx
├── credit/repayments/page.tsx
├── investments/page.tsx
├── investments/[id]/page.tsx
├── payments/page.tsx
├── notifications/page.tsx
└── settings/page.tsx
components/customer/{CustomerShell, StatCard, Timeline, DocTable, ...}
```

> Tous écrans partagent `CustomerShell`, `Badge`, `Button`, `Skeleton`, `EmptyState`, `ErrorState`.
