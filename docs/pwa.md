# KREDIT — Progressive Web App

> PWA installable, hors-ligne sécurisé, notifications push, mise à jour sans friction, performance Core Web Vitals.

---

## 0bis. Manifeste par locale (`/manifest/{locale}`)

Le manifeste est une ressource **hors arbre React** : il ne peut pas deviner la langue du visiteur.
Il est donc généré par locale :

- `lib/pwa-manifest.ts` construit `buildManifest(locale)` en surchargeant les champs dépendant de la
  langue (`name`, `description`, `lang`, `dir`, `id`, `start_url`, `shortcuts`, `protocol_handlers`,
  `share_target`) à partir de `public/manifest.json` (base : icônes, captures, couleurs, `display`)
  et des dictionnaires (`common:seo.*`, `common:nav.*`) ;
- `app/manifest/[locale]/route.ts` le sert (`force-static` + `generateStaticParams`,
  `application/manifest+json`, 404 pour une locale non supportée) ;
- `app/[locale]/layout.tsx` publie `manifest: \`/manifest/${locale}\`` dans ses métadonnées — le
  layout racine ne met plus `<link rel="manifest">` en dur ;
- `public/manifest.json` reste servi : c'est le repli des installations déjà présentes. Il ne doit
  contenir **aucune URL préfixée par une langue** (le test le vérifie) sinon le middleware
  redirigerait l'application installée vers la langue détectée du visiteur, pas vers celle de
  l'installation ;
- le matcher de `middleware.ts` exclut `manifest/` (comme `manifest.json`) : sinon la redirection de
  locale transforme `/manifest/nl` en `/nl/manifest/nl` (307) et la PWA ne s'installe plus — c'est le
  premier truc à vérifier quand un manifeste « 404 » alors que la route existe (`next build` liste les
  quatre `/manifest/{locale}` sont prérendérisées) ;
- `public/sw.js` traite `/manifest/*` comme un asset statique et la version est passée à
  `kredit-v6` : sans purge, les postes déjà installés gardaient en `CacheFirst` (30 j) l'ancien
  `/manifest.json` dont `start_url` valait `/fr?utm_source=homescreen`.

La page served offline est la même logique : `offlineFallbackUrl(locale)` (`lib/pwa.ts`) renvoie
`/{locale}/offline`, le SW precache les quatre et ne retombe sur `fr` que si la sienne manque.
## 1. Manifeste

`/manifest/{locale}` (W3C), construit par `lib/pwa-manifest.ts` à partir de
`frontend/public/manifest.json` pris comme **base** (voir §0bis — le fichier de base reste servi, mais
seulement comme repli des installations déjà présentes).

- **name** = `t(locale, "common:seo.title")` (`KREDIT — Krediet & Beleggen (België)` en `nl`, etc.)
  / **short_name** `KREDIT` — **description** = `common:seo.description`
- **id** `/{locale}`, **scope** `/`, **start_url** `/{locale}?utm_source=homescreen` — une
  installation depuis `/nl` ouvre `/nl`, plus `/fr`
- **display** `standalone` + `display_override: ["window-controls-overlay","standalone","browser"]`
- **theme_color / background_color** `#0F1115` (Dewi dark)
- **orientation** `any`, **lang** = la locale du segment, **dir** = `localeDir[locale]`, **categories** `finance,business`
- **icons** 10 entrées (72…512 + maskable 512) `purpose:any maskable` — génération ImageMagick depuis `base-1024.png` (#FF4A17 / #0F1115, K)
  - `icon-72.png` … `icon-512.png`, `maskable-512.png` (safe zone), `apple-touch-icon.png` (180)
- **screenshots** `desktop-1.png` (1280×720 wide) + `mobile-1.png` (720×1280 narrow)
- **shortcuts** 3, libellés dans `common:nav.*` et descriptions dans `common:seo.shortcut.*.description` :
  Simulateur (`/{locale}#simulateur`), Dashboard (`/{locale}/dashboard`), Investissements (`/{locale}/investments`)
- **related_applications** `[]`, **prefer_related_applications** `false`
- **handle_links** `preferred`, **launch_handler** `navigate-existing`, **edge_side_panel** 400
- **share_target** `GET /{locale}?share-target` + **protocol_handlers** `web+kredit` → `/{locale}?url=%s`
- le fichier de base ne contient **aucune** URL préfixée par une langue (vérifié par test)

Splash screen : généré par le navigateur depuis `background_color + theme_color + icons + name` ; iOS complément via `<link rel="apple-touch-icon">` + `apple-mobile-web-app-capable` + `apple-splash` (optionnel).

Responsive : manifest `orientation:any` + layout `viewport: width=device-width, initialScale=1, maximumScale=5, viewportFit=cover, safe-area-inset`.

---

## 2. Service Worker — `frontend/public/sw.js`

Version `kredit-v6`. Caches : `kredit-static-v6`, `kredit-public-v6`, `kredit-offline-v6`.
`VERSION` est le levier de purge : on la change dès qu'un champ servi hors requête change de sens
(ici le manifeste, §0bis ; pour le HTML, `docs/hydration.md` règle 9).

### Précache (install)

```
/ , /fr, /en, /nl, /de, /fr/offline, /manifest.json, /icons/icon-192.png, /icons/icon-512.png
```

`skipWaiting()` à l’install, `clients.claim()` + `navigationPreload.enable()` à l’activate. Nettoyage des anciens caches `kredit-*` non courants.

### Classification des requêtes

| Stratégie | ID | Quand | Requête |
|-----------|----|-------|---------|
| **STATIC_ASSETS** `CacheFirst` | `STATIC_ASSETS` | `/_next/static/*` **dont le nom porte un hash de build**, `/_next/image`, `/icons/*`, `/screenshots/*`, `*.js,*.css,*.woff2,*.png,*.svg`, `destination in [style,script,font,image]` | GET same-origin — sert du cache d’abord, n’écrit que si `reponseCacheable()` (`no-store`/`no-cache`/`max-age=0`/non-`200` refusés), TTL 30j, max 100. Un `/_next/**` non haché (dev, HMR) n’est pas intercepté : voir §14, contrainte 6 |
| **PUBLIC_CONTENT** `StaleWhileRevalidate` / `NetworkFirst` pour navigations | `PUBLIC_CONTENT` | `mode:navigate` vers `/` ou `/[locale]` non authentifié, `GET /api/v1/investment-products` | Sert cache immédiatement (stale), rafraîchit en arrière-plan. Pour navigations HTML : `NetworkFirst` 4s avec fallback cache/offline. |
| **AUTHENTICATED_CONTENT** `NetworkFirst` | `AUTHENTICATED_CONTENT` | navigations `/[locale]/(dashboard|credit|payments|investments|profile|security|admin|super|notifications|settings)`, `GET /api/v1/customer/*` restreint | `fetch` 5s → si échec, sert cache HTML shell si existant sinon `OFFLINE_URL`. **Jamais** de cache persistant du JSON perso ; seul le shell HTML peut être mis en cache brièvement. |
| **FINANCIAL_DATA** `NetworkOnly` | `FINANCIAL_DATA` | **tout** `method !== GET`, **tout** `/api/*`, `POST /payments`, `POST /investments`, `POST /credit/*` | **Jamais** mis en cache (`no-store`). En offline : `503` JSON `{code:"OFFLINE", message:"Connexion requise…"}` + header `X-KREDIT-Offline:1` pour navigations → `OFFLINE_URL`. |

**Sécurité** : aucune donnée financière/personnelle n’est mise en cache offline sans chiffrement. Les réponses `FINANCIAL_DATA` ne sont jamais `cache.put()`. `AUTHENTICATED_CONTENT` JSON n’est jamais mis en cache ; seul le HTML shell peut l’être (pour afficher l’état hors ligne). `CLEAR_SENSITIVE_CACHES` via `postMessage` supprime `public/offline` sur logout.

Fetch handling :

```js
if (method !== 'GET') return networkOnly(req);
if (origin !== self.origin) return; // sauf images unsplash → staleWhileRevalidate
if (isFinancialData(req)) return networkOnly(req);
if (isStaticAsset(req)) return cacheFirst(req, STATIC_CACHE);
if (isAuthenticatedContent(req)) return networkFirst(req, PUBLIC_CACHE, 5000);
if (isPublicContent(req)) return navigate? networkFirst : staleWhileRevalidate;
else if (navigate) return networkFirst(req, PUBLIC_CACHE);
```

Headers : `X-KREDIT-Cache-Strategy`, `X-KREDIT-Offline` sur réponses offline.

### Offline Fallback

- `OFFLINE_URL = /fr/offline` (localisé). En `fetch` échoué + `mode:navigate` → `caches.match(OFFLINE_URL)` sinon `/fr`.
- `GET /api/*` échoué → JSON 503 `OFFLINE`.

### Push, Sync, Messages

- `push` : `event.data.json()` → `showNotification({title, body, icon:/icons/icon-192.png, badge:/icons/icon-96.png, data:{url}, actions:[open,dismiss], vibrate})`
- `notificationclick` : `clients.matchAll` → `client.navigate(url)` + `focus()` sinon `openWindow(url)`
- `sync` tag `kredit-sync` → postMessage `SYNCING` / `SYNCED` + placeholder IndexedDB retry
- `message` : `SKIP_WAITING` → `skipWaiting()`, `GET_VERSION` → `postMessage({version})`, `CLEAR_SENSITIVE_CACHES` → `caches.delete(public/offline)`

---

## 3. UI — État connexion

`hooks/useConnectivity.ts` → `ONLINE | OFFLINE | SYNCING`

- Écoute `online/offline` + `navigator.serviceWorker.message` (`SYNCING`/`SYNCED`)
- `ONLINE` → vert `En ligne • Connecté au serveur` (ping)
- `OFFLINE` → rouge `Hors ligne • Fonctionnalités limitées`
- `SYNCING` → ambre `Synchronisation…` (spin 1.2s après `online`)

Composants :

- `components/pwa/ConnectivityStatus.tsx` — badge pills (`role=status, aria-live=polite`), variante `ConnectivityDot` pour header
- `components/pwa/OfflineNotice.tsx` — `OfflineBanner` (top banner rouge/ambre) + `ServerRequiredNotice` (alert `FINANCIAL_DATA`/`AUTHENTICATED_CONTENT` → explication stratégie + `no-store`)
- `app/[locale]/offline/page.tsx` — page fallback bilingue FR/EN/NL/DE, 2 colonnes : **Disponible hors ligne** (home, simulateur local, produits) vs **Nécessite connexion** (dossiers, paiements, investissements, docs) + CTA `Réessayer` + `Simulateur local`

Toute opération nécessitant le serveur affiche `ServerRequiredNotice` / `OfflineBanner` + désactivation bouton si `isOffline`.

---

## 4. Install Prompt

`hooks/useInstallPrompt.ts` — capte `beforeinstallprompt`, `preventDefault()`, expose `isInstallable`, `isStandalone` (`matchMedia(display-mode:standalone)`), `promptInstall()` → `deferred.prompt()` + `userChoice`.

`components/pwa/InstallPrompt.tsx` — banner bottom `fixed` (après 3s, non standalone, non dismissed) : icône, titre, description, badges PWA/Standalone/60kB, boutons `Installer` (calls `prompt()`) / `Plus tard` (localStorage `kredit-install-dismissed`). `appinstalled` → `standalone=true`.

---

## 5. Gestion mises à jour

`hooks/useSWUpdate.ts` — `register('/sw.js', {scope:'/'})`, `updatefound` → `installing.statechange === 'installed' && controller` → `waitingWorker` + `updateAvailable=true`. `controllerchange` → `location.reload()`. Vérif périodique 60s / 60min.

`components/pwa/UpdatePrompt.tsx` — toast top `Mise à jour disponible • Actualiser` (pulse vert) + `SKIP_WAITING` → `waitingWorker.postMessage`.

`components/pwa/SWRegister.tsx` — montage global dans `app/layout.tsx`, `load` → `register`, `update` hourly.

---

## 6. Notifications Push

`lib/push.ts` — `VAPID_PUBLIC_KEY = NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `urlBase64ToUint8Array`, `requestNotificationPermission()`, `subscribePush(reg)` → `reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey})` + `POST /api/v1/notifications/push/subscribe` (credentials include), `unsubscribePush`.

`hooks/usePushNotifications.ts` — `permission`, `subscribed`, `loading`, `subscribe/unsubscribe/refresh` via `navigator.serviceWorker.ready`.

`components/pwa/PushManager.tsx` — compact badge + full card : `Activer/Désactiver`, état permission, `denied` → aide réglages, note VAPID chiffrée.

---

## 7. Performance — Core Web Vitals

- **Fonts** : `next/font/google` `Raleway/Inter/Open_Sans` `display:swap` + CSS vars `var(--font-display/body)`, suppression `@import`
- **Images** : `next.config.images` `avif,webp`, `remotePatterns` unsplash/pravatar, `deviceSizes/imageSizes`, `priority` hero, `loading=lazy` elsewhere, `content-visibility:auto`
- **Headers** : `compress:true`, `poweredByHeader:false`, `optimizePackageImports:["lucide-react"]`, `Cache-Control: immutable` static/icons, `no-cache` sw/manifest, `Strict-Transport-Security`, `Permissions-Policy`, `X-DNS-Prefetch-Control`
- **CSS** : `globals.css` `focus-visible`, `safe-area-inset`, `prefers-reduced-motion`, `.cv-auto`, Tailwind `optimizePackageImports`
- **SW** : `navigationPreload`, `preloadResponse` dans fetch, `StaleWhileRevalidate` public, `CacheFirst` static
- **Vite** : `npm run build` Next 14 (103 pages SSG/SSR)

Métriques visées : LCP <2.5s (hero 56k, AVIF), INP <200ms (zustand, no heavy JS), CLS 0 (fixed header 72px, aspect ratios).

---

## 8. SEO

`app/layout.tsx` metadata :

- `title.template`, `description`, `keywords`, `authors`, `creator`, `category:finance`, `metadataBase:https://kredit.be`
- `alternates: {canonical:/fr, languages:{fr:/fr,en:/en,nl:/nl,de:/de}}`
- `openGraph: {title, description, url, siteName, locale:fr_BE, images:[icon-512]}`
- `twitter: {card:summary_large_image}`, `icons: {icon 72/192/512, apple 180}`, `appleWebApp: {capable, title, black-translucent}`, `manifest`
- `viewport: {themeColor:#0F1115, colorScheme:dark light, width:device-width, initialScale:1, viewportFit:cover}`
- `robots.txt` allow all + sitemap, `public/sitemap.xml` (généré)
- `header` `<link rel=preconnect>`, `<link rel=manifest>`, skip-link `href="#main"`

---

## 9. Accessibilité

- Skip link `Aller au contenu`, `main#main`, `focus-visible: ring-primary`
- `role=status/alert`, `aria-live=polite/assertive`, `aria-label` sur offline/install/update/push
- Contraste AA (ink #0F1115 / white, primary #FF4A17), `prefers-reduced-motion` reduce, `maximumScale:5`, clavier `focus:ring`
- Sémantique `header/main/footer/nav`, `lang` par locale, `alt` icons

---

## 10. Chargement mobile

- `viewportFit=cover` + `safe-area-inset`, `display:standalone`, touch `44px` min, `responsive` Tailwind `grid md:` etc.
- PWA installable (Add to Home Screen) → `standalone` plein écran sans chrome, shortcuts, splash
- Offline limité aux shells publics, spinner `SYNCING` sur reconnexion

---

## 11. Stratégies résumées (exigence)

```
STATIC_ASSETS       → CacheFirst        → /_next/static (URLS HACHÉES seulement), /icons, fonts
PUBLIC_CONTENT      → StaleWhileRevalidate / NetworkFirst (nav) → /, /[locale], simulateur shell
AUTHENTICATED_CONTENT → NetworkFirst + offline fallback (no JSON cache) → /dashboard, /credit/*
FINANCIAL_DATA      → NetworkOnly        → /api/*, POST, payments, investments
```

Aucune donnée `FINANCIAL_DATA` en CacheStorage/IndexedDB sans chiffrement. `AUTHENTICATED_CONTENT` JSON `no-store`.

---

## 12. Fichiers

```
frontend/public/manifest.json
frontend/public/sw.js
frontend/public/icons/icon-{72,96,128,144,152,180,192,384,512}.png + maskable-512.png + apple-touch-icon.png
frontend/public/screenshots/desktop-1.png + mobile-1.png
frontend/public/robots.txt
frontend/app/layout.tsx (fonts, metadata, viewport, SWRegister)
frontend/app/[locale]/layout.tsx (ConnectivityStatus + OfflineBanner + UpdatePrompt + InstallPrompt)
frontend/app/[locale]/offline/page.tsx
frontend/lib/pwa.ts + lib/push.ts
frontend/hooks/useConnectivity.ts + useInstallPrompt.ts + useSWUpdate.ts + usePushNotifications.ts
frontend/components/pwa/ConnectivityStatus.tsx + InstallPrompt.tsx + UpdatePrompt.tsx + OfflineNotice.tsx + PushManager.tsx + SWRegister.tsx
frontend/app/globals.css (+ focus, safe-area, reduced-motion)
frontend/next.config.js (headers, images, compress)
frontend/tailwind.config.js (font vars)
```

---

## 13. Test

```bash
npm run build # → 103 pages, SW & manifest dans public/
curl -I http://localhost:3000/sw.js # Cache-Control: max-age=0 must-revalidate, Service-Worker-Allowed: /
curl -I http://localhost:3000/manifest.json
# DevTools > Application > Manifest / Service Workers / Cache Storage
# Offline: DevTools > Network > Offline → navigue /, clique Financial → banner 503 + offline page
# Install: DevTools > Application > Manifest → Add to homescreen (beforeinstallprompt)
# Update: modifier sw VERSION → reload → toast Mise à jour
# Push: DevTools > Push → tester push event
```

---

## 14. Règle anti-hydratation — le HTML ne se met jamais en cache

Un document HTML resservi par le service worker alors que les chunks JS (`/_next/static/*`)
sont déjà ceux de la nouvelle version produit invariablement :

```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

Le DOM parsé ne correspond plus à l'arbre que le bundle client veut hydrater ; React jette
l'arbre, tout clignote et « Actualiser » semble ne rien corriger (le cache est toujours là).

Contraintes appliquées dans `frontend/public/sw.js` :

1. `PRECACHE_URLS` = page `/{locale}/offline`, `manifest.json`, icônes. **Jamais `/`, `/fr`,
   `/en`, `/nl`, `/de`** ni une page métier.
2. Navigations (documents) et payloads RSC (`?_rsc=`, en-tête `RSC: 1`) : `NetworkOnly` /
   `NetworkFirst` **sans écriture en cache**. Le fallback hors ligne est la page `/offline`
   (lue depuis `OFFLINE_CACHE`), jamais un document mis en cache au vol.
3. `StaleWhileRevalidate` réservé aux ressources non-HTML (garde sur `content-type`).
4. Toute modification du rendu embarque un bump de `VERSION` : `activate` purge les caches des
   versions précédentes (les visiteurs d'avant gardent sinon un cache empoisonné).
5. Le fallback hors ligne doit rester exécutable : `networkFirst`/`networkOnly` utilisent leur
   propre `new URL(req.url)` (un `url` hérité du scope `fetch` levait une `ReferenceError`).
6. **Un chunk non haché n'est jamais caché.** `/_next/static/chunks/webpack.js` (et `main-dev.js`,
   `app/…/page.js`, `/_next/webpack-hmr`) porte une URL stable en dev et change à chaque compile :
   le CacheFirst y renvoie un runtime webpack d'une compilation morte, les chunks restants venant de la
   compile courante — le navigateur lève alors
   `TypeError: Cannot read properties of undefined (reading 'call')` (`options.factory`). D'où
   `assetHache()` (le `/_next/**` sans hash n'est pas intercepté) et `reponseCacheable()` (aucune écriture
   si le serveur répond `no-store`/`no-cache`/`max-age=0`/non-`ok`).
7. **Le worker n'est pas enregistré en développement.** `SWRegister` est monté par le layout racine, donc
   sur toutes les pages : il s'abstente hors `production` et, à la place, désenregistre les registrations
   héritées et purge les caches `kredit-*` — un poste déjà parti en cache se répare au rechargement suivant.
   `next.config.js` ne déclare par ailleurs `/_next/static` en `immutable` qu'en production.

8. **`respondWith` ne reçoit jamais autre chose qu'une `Response`.** Toute réponse confisquée au
   réseau passe par `repondre(event, …)` → `versResponse(…)`: une valeur `undefined`/`null`, ou une
   promesse rejetée, fait échouer la requête interceptée avec
   `Uncaught (in promise) TypeError: Failed to convert value to 'Response'` — le worker transforme
   alors une simple panne réseau en page blanche. Le `staleWhileRevalidate` historique
   (`cached || (await fetchPromise) || fetchPromise`) rendait l'*objet promesse*, toujours truthy, puis
   se résolvait en `null`. Dernier recours: `Response.error()`, exactement ce que la page verrait sans
   worker. Règle `sw-respondwith-response` dans `check:hydration`.
9. **Un onglet déjà empoisonné se répare tout seul, même si React ne démarre pas.** `app/layout.tsx`
   sert, hors production uniquement, un script en ligne (`lib/dev-sw-heal.ts`) qui désenregistre toute
   registration héritée, purge les caches `kredit-*` et recharge **une** fois (drapeau
   `sessionStorage`, donc aucune boucle possible). Le placement est mesuré, pas supposé : premier
   enfant du `<head>` comme en `strategy="beforeInteractive"`, il tombe en position 4417/4725 du HTML
   servi, donc **après** les `<script src="/_next/static/chunks/…">` injectés par Next dès la position
   569 — rien, dans un layout App Router, ne peut les précéder. Ce n'est pas bloquant : un
   `<script>` classique s'exécute même si un script d'avant a jeté. Le premier chargement échoue donc
   encore, le second est propre. C'est le seul chemin par lequel un `webpack.js` figé en cache se
   répare sans ouvrir DevTools : après cette panne, plus aucun code applicatif ne tourne.

Ce fichier est vérifié hors CI par `npm --prefix frontend run check:hydration`, qui interdit
les documents HTML dans `PRECACHE_URLS` (`sw-cached-document`), toute écriture de cache non gardée et
tout enregistrement hors production (`sw-cache-unstable-chunk`, `sw-registered-in-dev`). Le comportement
réel du worker est exécuté dans `frontend/tests/pwa/sw-cache-policy.spec.ts` ; la garde d'enregistrement
dans `frontend/tests/unit/sw-register-dev.spec.tsx`. Voir aussi `docs/hydration.md` §2 règle 12.

---

## 15. Copie des composants PWA — localisée, et interdite de français en dur

Les cinq composants de `components/pwa/` (pastille de connexion, bandeau hors ligne, invite d'installation,
mise à jour du service worker, notifications push) sont rendus par `app/[locale]/layout.tsx` sur **toutes**
les pages, dont la page de repli `/[locale]/offline` servie par le service worker. Leur copie tient
entièrement dans les dictionnaires (`common:pwa.*`, 41 clés × 4 langues) et le répertoire est sous **règle
dure** dans `scripts/check-copy.mjs` (`FLOOR_DIRS`), comme les coquilles client et admin : zéro ligne de
français en dur, aucun budget résiduel.

Deux règles sorties de ce chapitre :

- **Aucun défaut de prop textuel.** `{ actionLabel = "Opération" }` est une chaîne française que le
  dictionnaire ne peut pas corriger : la prop est optionnelle et sa valeur par défaut sort de
  `t("pwa.operation")`. C'est le seul cas où `check-copy` refuse une chaîne d'un seul mot.
- **`CACHE_STRATEGIES` ne parle pas à l'utilisateur.** `description`, `docs` et `clientSide` de `lib/pwa.ts`
  restent en français : documentation développeur, module importé par le middleware (bundle edge), et
  l'interface n'affiche que l'identifiant de stratégie. Un composant ne propage pas ces champs dans le DOM.

Vérification : `tests/unit/pwa-chrome-i18n.spec.tsx` (montage jsdom des quatre marchés, `renderToString` de la
page offline) et `npm run check:copy` en statique.
