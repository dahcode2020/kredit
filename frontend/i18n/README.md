# i18n — KREDIT (FR/EN/NL/DE + fr-BE)

Source de vérité : `frontend/i18n/{fr,en,nl,de}/*.json` (11 namespaces) + `backend/src/i18n/locales/{fr,en,nl,de}/*.json` (sync).

## Structure
```
i18n/
├── fr/ {common,auth,dashboard,credit,investment,payments,documents,notifications,admin,errors,legal}.json + fr-BE.json (override)
├── en/ (même 11)
├── nl/ (même 11)
└── de/ (même 11)
```
- `common` : nav, header, footer, SEO
- `auth` : login, MFA
- `dashboard` : customer home
- `credit` : simulateur, demande, éligibilité, historique
- `investment` : catalogue, risque
- `payments` : échéances, PSP
- `documents` : upload S3
- `notifications` : centre + préférences
- `admin` : back-office
- `errors` : codes API → messages
- `legal` : disclaimers RGPD/SECCI

## Usage
```ts
// ❌ INTERDIT
<button>Approuver</button>
// ✅
import { useTranslation } from "@/hooks/useTranslation";
const { t } = useTranslation("admin");
<button>{t("decision.approve")}</button>

// Avec vars + plural
t("credit:documents.count", { count: 3 }) // "3 documents" (fr) / "3 documents" via ICU

// Formats
import { formatCurrency, formatDate, formatPhoneBE } from "@/lib/formatters";
formatCurrency(15000, locale) // 15 000,00 € (fr-BE) vs €15,000.00 (en-BE)
formatDate(new Date(), locale) // 09/09/2026
formatPhoneBE("+32470123456") // +32 470 12 34 56
```

## Détection
1. `NEXT_LOCALE` cookie / `localStorage:kredit-locale` / `users.locale` (DB) — préférence utilisateur
2. `Accept-Language` + `navigator.languages` — navigateur
3. `fr` — défaut

Persistance 1 an `SameSite=Lax`, `localStorage`, `PATCH /api/v1/customers/me/preferences`.

## fr-BE
`fr.json` = neutre, `fr-BE.json` override lexique belge (septante, BNB/FSMA, itsme®, Registre national). Resolver merge `fr` ← `fr-BE`. Même logique `nl-BE`/`de-BE`.

## Lint
`no-restricted-syntax` bloque littéraux hors `className`/`aria-*`. Toute chaîne UI doit passer par `t()`.

## Backend
Même clés dans `backend/src/i18n/locales/` + `I18nService.t(locale, key, vars)` pour Email/WhatsApp/SMS.

## Templates
Voir `docs/i18n.md` (architecture) + `docs/notifications.md` (§8) pour exemples WhatsApp HSM etc. Admin édite via `/[locale]/admin/notifications`.
