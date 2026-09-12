# Portail client — authentification, rôles, et le pont simulation → demande

## 1. Le parcours, dans l'ordre

```
  accueil (fr/en/nl/de)
     │  « Espace client » (en-tête)        carte d'un rôle        CTA du simulateur
     ▼                                        │                        ▼
  /{locale}/auth ◄────────────────────────────┘                /{locale}/demande
     │  onglet « Se connecter »                                   │ 4 étapes, pré-remplies
     │  onglet « Créer un compte »                               │ par le brouillon de simulation
     │  back-office → écran « Vérification en 2 étapes »          ▼
     ▼                                                        dépôt + référence
  destination selon le RÔLE DU COMPTE:
     CUSTOMER    → /{locale}/dashboard
     ADMIN       → /{locale}/admin/dashboard
     SUPER_ADMIN → /{locale}/super
```

Un seul écran d'authentification pour les trois rôles (c'était la demande), et la **demande de crédit
ne repart pas de zéro** : elle hérite du montant, de la durée, des revenus, des charges, des crédits en
cours, du produit et de l'objet saisis dans le simulateur.

## 2. Les trois règles qui structurent le code

| Règle | Où | Pourquoi |
| --- | --- | --- |
| Le rôle **vient du compte**, jamais d'un sélecteur | `lib/auth-service.ts` → `seConnecter` | La puce « Client / Administrateur / Super administrateur » de l'interface préserve une intention de démonstration et annonce le second facteur. Elle n'accorde rien. Un bouton qui choisit un rôle est un bouton « devenir admin ». |
| Le **second facteur est décidé par le service** | `mfaRequis` sur la réponse | Une page qui oublierait l'écran MFA ne peut pas ouvrir le back-office. `codeMfaValide` exige 6 chiffres ; `CODE_DEMO` (`123456`) est affiché à l'écran, pas caché — une démo qui fait semblant de sécuriser enseigne faux. |
| **Aucune connexion tolérante** | `seConnecter` renvoie `INVALIDE` | Un mot de passe qui ne correspond pas ne connecte pas « puisque c'est une démo ». C'est ce qui rend l'écran crédible à relire. |

## 3. `/{locale}/auth` — ce qui est sur l'écran

- **Onglets** connexion / inscription, une pastille qui glisse (`.pastilles` dans `app/globals.css`),
  et un lien de bascule en pied de carte : on ne cherche pas le bon onglet, on y est amené.
- **Champs à étiquette flottante** (`.champ`) : l'étiquette monte au focus ou quand une valeur est
  saisie, elle ne disparaît jamais — un champ dont on a oublié l'objet est un champ qu'on abandonne.
- **Œil** sur le mot de passe, **jauge à quatre barres** (jamais un pourcentage : c'est une aide, pas un
  score), et à l'inscription une **confirmation** comparée.
- **Comptes de démonstration cliquables** dans la colonne sombre : un clic remplit e-mail et mot de
  passe. La liste est filtrée par le rôle visé, et vient de `COMPTES_DEMO` — pas d'une chaîne tapée
  dans le JSX de la page d'accueil (l'ancienne ligne affichait `alex@kredit.be`, un compte qui
  n'existait nulle part).
- **La mascotte** (`components/auth/Mascotte.tsx`) : une carte bancaire à yeux, dessinée en SVG, qui
  flotte et suit le pointeur du regard. Son `data-moral` passe en `attentif` dès qu'un champ est en
  erreur et en `content` à la réussite. Ce n'est pas un ornement : l'écran de connexion est celui où
  l'on hésite, et un visage qui ne réagit pas à une erreur est une moquerie.
- **`oublier note`** : le lien « Mot de passe oublié ? » n'envoie rien et le dit, au lieu de mener à
  une route morte.

## 4. Le pont avec le simulateur

`hooks/useDemande.ts` (zustand + `persist`, `skipHydration: true`) porte :

- `simulation` — le **brouillon** posé par le bouton du simulateur (`demander()` dans
  `components/credit/Simulator.tsx`) : montant, durée, revenus, charges, crédits, produit, objet, plus
  le résultat lu (mensualité, TAEG, intérêts, coût, score, grade, recommandation) ;
- `champs` — ce qui a été tapé dans le formulaire, pour reprendre à la bonne étape ;
- `depots` — les demandes soumises, **non persistées** volontairement : `partialize` ne sort que le
  brouillon. Conserver dans `localStorage` des noms, adresses et revenus saisis sur un poste partagé
  serait une fuite, pas une fonctionnalité.

Le formulaire (`components/credit/FormDemande.tsx`) recalcule son panneau de droite avec
`simulateCredit` sur l'état **courant** : changer le montant ici bouge la mensualité, le TAEG et le
score. Un récap figé sur la simulation d'hier serait un second tableau de bord, et donc un second
mensonge possible. Les bornes acceptées viennent de `PRODUITS` (grille du 12/09/2026) : le formulaire
ne connaît aucun plafond par cœur.

Un visiteur **déjà connecté** ne re-remplit pas son compte : l'étape 1 devient une ligne de contexte.
Un visiteur **non connecté** crée son compte à cette même étape 1 — l'inscription est là, pas dans un
tunnel séparé avant la demande.

## 5. Règles de validation (et où elles vivent)

Dans `lib/auth-service.ts`, pas dans les composants — c'est ce qui permet de les tester sans
navigateur et de les réutiliser côté `/{locale}/demande` :

| Règle | Fonction | Détail |
| --- | --- | --- |
| E-mail | `emailValide` | forme locale + domaine + TLD ≥ 2 ; la casse et les espaces de bord sont ignorées à la connexion |
| Mot de passe | `motDePasseValide` | ≥ 8 caractères **et** un chiffre |
| Force affichée | `forceDuMotDePasse` | 0–4, plafonnée à 1 sous 8 caractères (une jauge joyeuse sur un mot de passe refusé est un contre-message) |
| Téléphone | `telephoneValide` | `libphonenumber-js`, facultatif à l'inscription, `BE` par défaut |
| Second facteur | `codeMfaValide` | 6 chiffres exactement |
| Consentement | `sInscrire` → `CHAMP/gdpr` | refusé sans `acceptGdpr`, comme le backend (`400 GDPR_REQUIRED`) |
| Doublon | `sInscrire` → `EXISTS` | un e-mail déjà pris n'écrase pas le compte (miroir du `409 EMAIL_ALREADY_EXISTS` du backend) |
| Âge | `âgeAuJour` dans le formulaire | ≥ 18, calculé **au dépôt** : une date « aujourd'hui » au render diffère entre serveur et navigateur |

## 6. Démo côté mock, réel côté API

`NEXT_PUBLIC_API_URL` posé → `POST /api/v1/auth/login` et `/api/v1/auth/register` sont appelés
(forme alignée sur `backend/src/api/auth.controller.ts` : `email`/`password`/`locale`,
`X-Idempotency-Key` à l'inscription, `409` et `GDPR_REQUIRED` traduits en erreurs de champ). Si
l'appel échoue — port non exposé dans un codespace, backend arrêté — on retombe sur les comptes de
démonstration **sans afficher d'erreur réseau** : un écran de connexion qui ne s'affiche pas à cause
d'un backend absent est un bien pire résultat qu'une démo locale honnête. Ce choix est écrit ici parce
qu'il est délibéré, pas une approximation à corriger plus tard.

## 7. Hydratation : pourquoi l'intention arrive en effet

`/{locale}/auth` lit l'intention de la page d'accueil (rôle visé, compte cliqué, mode) dans
`hooks/usePortail.ts` — un store **non persisté**, appliqué en `useEffect`. Deux raisons :

- lire `localStorage` ou un store persisté au render ferait diverger le premier rendu client du HTML
  servi : exactement la panne que `docs/hydration.md` pourchasse ;
- un rôle mémorisé entre deux visites est un rôle qui survit à une déconnexion.

Idem pour le brouillon de demande : relu après hydratation (`useDemandeHydratee`), jamais au render.
Le marqueur `data-shown="false"` des apparitions est écrit par le serveur et par le premier rendu
client, si bien que l'animation ne peut pas créer d'écart.

## 8. Ajouter un champ au formulaire de demande

1. clé dans `i18n/{fr,en,nl,de}/auth.json` — les quatre, sinon le HTML des trois autres langues rend la
   clé brute. Deux contrôles le vérifient : `tests/unit/i18n-keys-usage.spec.ts` (les appels
   `tr("a.b")` / `t(locale, "a.b")` du code) et le contrôle d'idiome `ta()` de
   `tests/unit/auth-flow.spec.tsx`, parce que le portail passe par `tNs(locale, "auth", …)` et que le
   premier motif ne verrait pas ces chaînes ;
2. type dans `ChampsDemande` (`hooks/useDemande.ts`) si la valeur doit survivre à un rechargement ;
3. validation dans `lib/auth-service.ts` si elle est réutilisable, dans le composant sinon ;
4. un cas dans `tests/unit/auth-flow.spec.tsx`.

Aucune chaîne française en dur dans `app/` ou `components/` : le garde-fou de copie applique un budget
de zéro à tout fichier nouveau, ce qui est une aide ici — l'écran du portail est littéralement le même
en quatre langues ou il ne l'est pas.

## 9. Vérifié

`tests/unit/auth-flow.spec.tsx` — 31 cas : rôles et destinations, indice d'adresse qui ne vaut pas
autorisation, MFA exigé pour le back-office, mot de passe erroné qui ne connecte pas, validateurs,
brouillon repris puis libéré au dépôt, et le rendu client qui démontre que la pré-remplissure arrive
**après** le premier paint. Le HTML servi de `/fr/auth` porte les deux onglets, les trois rôles, les
comptes de démo, la mascotte, et `robots: noindex` (une page de connexion indexée est une porte
d'entrée offerte, et elle n'a rien à lire).
