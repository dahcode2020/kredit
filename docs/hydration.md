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

8. **Le service worker ne doit jamais servir un document HTML périmé.** Le SW precachait
   `/`, `/fr`, `/en`, `/nl`, `/de` et écrivait les réponses de navigation en cache : après un
   déploiement, le navigateur recevait l'ancien HTML avec les nouveaux chunks → hydratation
   cassée, et le cache ne se purgeait que si `VERSION` était bumpé à la main.
   → `public/sw.js` : plus aucun HTML en cache (précaches = page `/offline`, manifest, icônes,
   assets hachés), payloads RSC en `NetworkOnly`, `VERSION` incrémentée pour purger les caches
   corrompus des visiteurs existants, et correction des `ReferenceError: url is not defined`
   dans `networkFirst`/`networkOnly` (le fallback offline levait → rechargements en boucle).

## 3. Vérification

```bash
cd frontend
npm run check:hydration          # garde-fous statiques (zéro dépendance) : APIs au render + imbrications HTML
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
