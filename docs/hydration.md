# Hydratation SSR ↔ client — règles et correctifs

Erreur observée :

```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

En App Router (Next 14 / React 18), cette erreur signifie une seule chose : **le premier
rendu du client ne reproduit pas le HTML envoyé par le serveur**. React ne « rattrape » pas
l'écart : il jette l'arbre et re-rend tout (d'où le flash et les corrections qui
« disparaissent au refresh »).

## 1. Lire le warning au-dessus de l'overlay

| Warning React | Cause |
|---|---|
| `Text content did not match. Server: "…" Client: "…"` | formatage (locale/`Intl`/dates) ou i18n non aligné |
| `Extra attributes from the server HTML: class, style` | attribut muté hors React (thème, extension navigateur) |
| `Did not expect server HTML to contain a <div> in <div>` | arbre différent : rendu conditionnel lié à `window`, `localStorage`, SW, portal |
| `validateDOMNesting` | HTML invalide : le navigateur corrige le HTML, React hydrate l'original |
| aucun autre warning | écart de structure (voir §2) |

## 2. Règles appliquées dans ce dépôt

1. **Aucune API navigateur pendant le render** d'un client component
   (`window`, `document`, `localStorage`, `navigator`, `Notification`, `matchMedia`).
   Le serveur renvoie une valeur, le navigateur une autre → mismatch. À déplacer dans un
   `useEffect` (ou `useSyncExternalStore` avec un snapshot serveur explicite).
   → corrigé dans `hooks/usePushNotifications.ts`, `components/pwa/PushManager.tsx`, `hooks/useLocale.ts`.

2. **Pas de branche de rendu sur l'environnement** : `if (typeof window !== 'undefined') return <A/>`
   sert `<B/>` côté serveur. Rendre le même arbre (placeholder de même forme) puis ajuster.
   → corrigé dans `components/pwa/PushManager.tsx`, et le pattern `hasHydrated` des shells
   (`AdminShell`, `CustomerShell`, `Header`) qui rend **le même skeleton** au premier rendu client.

3. **Locale Intl explicite partout + sorties normalisées** : jamais `toLocaleString()`, `toLocaleDateString()` ni
   `new Intl.NumberFormat(undefined, …)` — la locale par défaut du runtime diffère entre le
   conteneur Node et le navigateur. Utiliser `localeToIntl[locale]` (`lib/formatters.ts`).
   Dates : `timeZone: 'Europe/Brussels'` forcé (déjà le cas dans `lib/formatters.ts`) ;
   corrigé dans `components/credit/Simulator.tsx` qui écrivait `"fr-BE"` en dur.

4. **Valeurs « maintenant »** (année, heure relative, date du jour) : rendues seulement après
   hydratation, sinon le serveur (UTC) et le navigateur (UTC+1/+2) peuvent changer de jour.
   → `components/layout/Footer.tsx` (l'année n'est plus substituée par un `2026` codé en dur).

5. **`suppressHydrationWarning` n'est pas un correctif.** Le prop ne porte **que** sur
   l'élément qui le reçoit (ses attributs/texte propre), jamais sur ses descendants : posé sur
   un `<main>` ou un `<div>` de page, il masquait le diagnostic sans rien réparer. Il n'est
   conservé que sur `<html>` dans `app/layout.tsx`, c'est-à-dire là où `lang` est muté hors React.

6. **`<html lang>` aligné sur le segment `[locale]`** : le layout racine ne reçoit pas les
   params des segments enfants (vérifié : `params === {}` en Next 14.2). Un effect
   (`components/layout/HtmlLang.tsx`) applique `lang`/`dir` après hydratation — mutation hors
   arbre React, donc sans risque d'hydratation.

7. **Balisage valide, sinon le navigateur réécrit le DOM.** Un `<div>` dans un `<p>` ferme le
   `<p>` ; un `<li>` hors `<ul>` est remonté ; un `<button>` dans un `<a>` est un contenu
   interactif imbriqué interdit. Le HTML parsé ne correspond plus à l'arbre React → mismatch.
   Le projet rendait donc `<Link><Button/></Link>` sur le hero et dans le header ; `Button`
   expose maintenant `buttonClasses(variant, size, className)` pour poser le style sur le
   `<Link>` lui-même (`app/[locale]/page.tsx`, `components/layout/Header.tsx`).
   Détecté par `node scripts/check-dom-nesting.mjs` (inclus dans `npm run check:hydration`).

8. **Une seule source pour la détection de locale.** `middleware.ts` et `lib/i18n.ts`
   contenaient chacun leur copie de `parseAcceptLanguage` + leur liste de locales : deux
   implémentations qui divergent = une langue choisie côté edge/serveur et une autre côté client
   → tous les textes traduits mismatchent. Tout passe désormais par `lib/locale-detection.ts`
   (sans dépendance à `next/server` ni au DOM : exécutable en Edge, en Node et en navigateur,
   et testable en unit). Le cookie `NEXT_LOCALE` y a aussi une seule définition d'attributs
   (`SameSite=Lax`, 1 an, `Secure` dès que le contexte est HTTPS).

9. **Le service worker ne doit jamais servir un document HTML périmé.** Le SW precachait
   `/`, `/fr`, `/en`, `/nl`, `/de` et écrivait les réponses de navigation en cache : après un
   déploiement, le navigateur recevait l'ancien HTML avec les nouveaux chunks → hydratation
   cassée, et le cache ne se purgeait que si `VERSION` était bumpé à la main.
   → `public/sw.js` : plus aucun HTML en cache (précaches = page `/offline`, manifest, icônes,
   assets hachés), payloads RSC en `NetworkOnly`, `VERSION` incrémentée pour purger les caches
   corrompus des visiteurs existants, et correction des `ReferenceError: url is not defined`
   dans `networkFirst`/`networkOnly` (le fallback offline levait → rechargements en boucle).

10. **Un instant ne se lit pas dans le rendu, et une date ne se parse pas « à la légère ».**
    Deux pièges distincts, tous deux corrigés :
    - les chaînes `YYYY-MM-DD HH:mm` (SQL, mocks) passées à `new Date()` sont lues en **heure
      locale du runtime** : `2026-09-09 14:22` devient 14:22Z sur un serveur UTC et 14:22+02:00
      dans un navigateur belge → la même ligne de liste s'affiche à deux heures, parfois à deux
      **jours**. `resolveDate()` (`lib/formatters.ts`) ancre ces valeurs sur UTC, avertit en
      développement et réclame de l'ISO-8601 avec décalage à la source ; `formatDate`,
      `formatDateTime`, `formatDateLong` et `relativeTime` y passent tous et forcent
      `timeZone: Europe/Brussels`. Une valeur invalide rend une chaîne vide au lieu de faire
      planter `Intl` (`RangeError: Invalid time value`) — un champ de date manquant ne doit pas
      emporter la page.
    - « il y a 3 heures » dépend de l'horloge : `formatRelative()` lit `Date.now()` à l'appel et
      est donc **interdit dans un composant** (règle `relative-time-in-render` de
      `scripts/check-hydration.mjs`, avec `raw-date-parse` pour les chaînes sans décalage).
      À la place, `<RelativeTime date locale now />` (`components/ui/RelativeTime.tsx`) :
      premier rendu déterministe — date absolue, ou relatif calculé depuis le `now` **reçu en prop
      du serveur** si on veut éviter le saut visuel — puis bascule en relatif dans un
      `useEffect`, rafraîchi toutes les 60 s et nettoyé au démontage. Le `<time dateTime=… title=…>`
      conserve l'instant exact : l'information ne dépend jamais du moment où le HTML a été produit.

    Les données suivent la même règle : `lib/mock.ts` écrit `2026-09-09T14:22:00+02:00`.

11. **Aucun tag ni liste de locale dans `app/` et `components/`.** Huit pages écrivaient
    `formatEUR2(v, "fr-BE")` (et le layout racine `canonical: "/fr"` + `locale: "fr_BE"`), parce que
    `formatEUR/formatEUR2` avaient un **défaut** `locale = "fr-BE"` : un utilisateur `nl`, `de` ou
    `en` recevait du français, sans erreur nulle part. Trois verrous :
    - les formatteurs de l'app ne prennent **que** la locale applicative (`fr|en|nl|de`) — le
      paramètre est **obligatoire** et typé `Locale`, donc `formatEUR2(v, "fr-BE")` ne *compile plus* ;
      la conversion `Locale → tag Intl` a lieu dans `lib/` (`localeToIntl`, source unique, ré-exportée
      par `lib/formatters.ts`) ;
    - les tables de noms/étiquettes/codes sont dans `lib/i18n.ts` : `localeToIntl`, `localeLabels`,
      `localeTagLabel` (dérivée), `openGraphLocale`, `whatsappLocale`. Un composant qui a besoin d'un
      tag (le sélecteur de langue affiche `FR-BE`) lit la table, il ne recopie pas ;
    - `scripts/check-hydration.mjs` interdit désormais `locale-tag-literal` (chaîne `"fr-BE"`/`"nl_BE"`
      dans `app/`+`components/`), `locale-arg-literal` (locale en argument d'un formatteur, dont
      `t("fr", …)`), `locale-list-literal` (liste `['fr','en','nl','de']` recopiée — c'est ainsi qu'un
      template `fr` était exclu de son propre aperçu) et `intl-tag-in-ui` (`localeToIntl` importé dans
      un composant ; seule exception documentée : `components/layout/HtmlLang.tsx`, qui pose
      `data-intl` hors arbre React). Deux règles jumelles verrouillent la variante « hors arbre
      React » du même défaut (passée 6) : `localized-url-literal` (aucune URL commençant par
      `/fr/`… dans `app/`, `components/`, `lib/`, `hooks/` — c'est ainsi que `start_url` du manifeste
      PWA et les motifs de cache étaient français pour tout le monde) et `untranslated-metadata`
      (aucun `title:`/`description:` en littéral dans un `layout.tsx`/`route.ts` de `app/` : cette
      copie passe par `t(locale, "common:seo.*")`).
      S'ajoute `scripts/check-copy.mjs` (`npm run check:copy`, dans `npm run check`) : budget de copie
      française par fichier — **zéro** dans `components/customer/**` et `components/admin/**`, qui
      enveloppent toutes les pages métier (leur nav en dur rendait le menu français sur /nl et /de),
      et compteur figé ailleurs, donc non croissant. Détail inattendu relevé au passage : ces coquilles
      rendent un skeleton tant que le store `persist` n'a pas parlé, donc le HTML serveur ne contient
      aucune copie — un test fige cette égalité (`shell-i18n.spec.tsx`) pour qu'on n'aille pas « corriger »
      ce qui n'a jamais cassé l'hydratation.

    Conséquence mesurée au passage (et piégée par un test) : Next **remplace** le bloc `openGraph`
    entre parent et enfant au lieu de le fusionner — le redéclarer à moitié dans le layout enfant
    supprimait silencieusement `og:image`, `og:site_name` et `og:type`. Le bloc complet vit donc dans
    `app/[locale]/layout.tsx`, avec les constantes partagées dans `lib/seo.ts`.

    Ces littéraux n'étaient pas un mismatch en soi — serveur et navigateur affichaient le **même**
    texte faux — mais la classe exacte de divergence apparaît dès qu'un appelant, lui, dérive la
    locale du segment (deux formats dans la même page). Le vrai défaut observable était ailleurs :
    voir §« SEO » de `docs/i18n.md` (canonical croisé sur /en, /nl, /de et `og:locale` refusé par le
    parseur Open Graph).

## 3. Vérification

Verrous permanents dans la suite Jest (`npm --prefix frontend test`) :

- `tests/unit/hydration.spec.ts` — aucun espace non normalisé ne sort des formatteurs, et la
  sortie est **identique** que le runtime emploie U+202F ou U+00A0 (le test simule un CLDR de
  navigateur en proxifiant `Intl.NumberFormat`), plus la table de priorité de détection de locale ;
- `tests/unit/locale-propagation.spec.tsx` — table de tags unique (`localeToIntl` de
  `lib/formatters` **est** celle de `lib/i18n`, identité d'objet), `openGraphLocale` complet et sans
  `fr_BE`, `generateMetadata` du layout `[locale]` (canonical/hreflang/og par segment), et **montage
  réel** de la page Paiements en `fr` puis `nl` pour vérifier que le montant suit la langue de l'URL
  (et que le HTML serveur reste le skeleton — ces pages client ne mettent pas les montants dans le
  HTML) ;
- `tests/unit/dates-timezone.spec.tsx` — `resolveDate` (ancrage UTC, offsets explicites, « jour
  seul », valeur invalide), pureté de `relativeTime` (l'appel échoue si l'horloge est lue), et
  **hydratation réelle** de `<RelativeTime>` : `renderToString` puis `hydrateRoot` dans jsdom,
  avec `onRecoverableError` + écoute de `console.error` (un écart de texte ferait échouer le test).

Le fuseau du processus de test est épinglé par `tests/global-setup.js` (`TZ=Europe/Brussels`) :
sinon un CI en UTC rendrait indétectable le retour d'un parse « à la locale ».

```bash
cd frontend
npm run lint                     # eslint-config-next + react/no-unescaped-entities (voir .eslintrc.json)
npm test                         # verrous Jest (tests/unit/hydration.spec.ts)
npm run check:hydration          # garde-fous statiques (zéro dépendance) : APIs au render, dates
                                 # sans décalage, temps relatif au render, imbrications HTML
npx next build                   # le prerender de toutes les pages [locale] casse si un render touche une API navigateur
```

En pratique, pour un composant douteux :

```bash
curl -s localhost:3000/fr > /tmp/server.html   # HTML serveur réel
```
puis, dans DevTools, comparer le `outerHTML` du même conteneur : **le premier** nœud divergent
est la cause (pas le dernier). Test complémentaire : naviguer vers la page via un `<Link>` —
si l'erreur disparaît, l'écart vient bien du rendu serveur vs premier rendu client.

## 4. Diagnostic d'un mismatch restant

1. Fenêtre privée (extensions = `Extra attributes from the server HTML`).
2. `npx next build && npm start` : propre en prod mais pas en `dev` → double-render StrictMode
   ou effet qui modifie le markup initial.
3. DevTools → cocher « Pause on exceptions » dans la catégorie des erreurs non catchées, ou
   ajouter temporairement `onRecoverableError` via un `ErrorBoundary` pour logger l'écart.
4. HTML minifié/caché en amont (proxy, Cloudflare) : les marqueurs `<!--$-->` de React doivent
   survivre, sinon l'hydratation échoue globalement — vider le cache, pas le composant.
5. CSS-in-JS (styled-components/emotion) non enregistré au SSR → attributs `class`/`style`
   différents : configurer le registry serveur, ne pas `suppressHydrationWarning`.

## 5. Reproduction et mesure (sans navigateur)

jsdom suffit, puisqu'il exécute les vrais chunks client de Next : React hydrate réellement la page.

```bash
cd frontend
npm i -D jsdom                 # dépendance du harnais uniquement (non requise au build)
npm run dev                    # :3000
npm run check:hydrate -- --skew-intl --wait 12000 --routes /fr /en /credit/simulator
```

`scripts/hydrate-check.mjs` rend `exit 1` si une page présente un écart serveur/client.

Le principe du script : charger l'URL, attendre, et compter les `console.error` React contenant
`hydrat|did not match|Text content|server HTML`. Pour simuler le décalage de CLDR entre le serveur
Node et le navigateur, on redéfinit `window.Intl.NumberFormat`/`DateTimeFormat` dans `beforeParse`
pour qu'ils renvoient U+00A0 là où Node renvoie U+202F — et là, sur le code d'origine :

```
Warning: Text content did not match. Server: "15 000,00 €" Client: "15 000,00 €"
Error: Text content does not match server-rendered HTML.
An error occurred during hydration. The server HTML was replaced with client content in <%s>.
→ 10 erreurs sur /fr
```

Après les correctifs (`lib/intl.ts` + formatteurs + retraits des bandages), le même scenario
donne `hydrationIssues: 0` sur `/fr`, `/en`, `/nl`, `/credit/simulator`, `/admin/dashboard`,
`/examples/i18n`, `/investments` — vérifié avec React en mode dev, `reactStrictMode: true`.
`node scripts/check-hydration.mjs` (règle `raw-intl-outside-lib`) empêche le formatage `Intl`
non normalisé de revenir dans `app/` et `components/`.
