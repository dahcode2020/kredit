# KREDIT — Progressive Web App

> PWA installable, hors-ligne sécurisé, notifications push, mise à jour sans friction, performance Core Web Vitals.

---

## 1. Manifeste

`frontend/public/manifest.json` (W3C)

- **name** `KREDIT — Crédit & Investissement (BE)` / **short_name** `KREDIT`
- **id** `/`, **scope** `/`, **start_url** `/fr?utm_source=homescreen`
- **display** `standalone` + `display_override: ["window-controls-overlay","standalone","browser"]`
- **theme_color / background_color** `#0F1115` (Dewi dark)
- **orientation** `any`, **lang** `fr`, **dir** `ltr`, **categories** `finance,business`
- **icons** 10 entrées (72…512 + maskable 512) `purpose:any maskable` — génération ImageMagick depuis `base-1024.png` (#FF4A17 / #0F1115, K)
  - `icon-72.png` … `icon-512.png`, `maskable-512.png` (safe zone), `apple-touch-icon.png` (180)
- **screenshots** `desktop-1.png` (1280×720 wide) + `mobile-1.png` (720×1280 narrow)
- **shortcuts** 3 : Simulateur (`/fr#simulateur`), Dashboard (`/fr/dashboard`), Investissements (`/fr/investments`)
- **related_applications** `[]`, **prefer_related_applications** `false`
- **handle_links** `preferred`, **launch_handler** `navigate-existing`, **edge_side_panel** 400
- **share_target** `GET /fr?share-target` + **protocol_handlers** `web+kredit`

Splash screen : généré par le navigateur depuis `background_color + theme_color + icons + name` ; iOS complément via `<link rel="apple-touch-icon">` + `apple-mobile-web-app-capable` + `apple-splash` (optionnel).

Responsive : manifest `orientation:any` + layout `viewport: width=device-width, initialScale=1, maximumScale=5, viewportFit=cover, safe-area-inset`.

---

## 2. Service Worker — `frontend/public/sw.js`

Version `kredit-v2`. Caches : `kredit-static-v2`, `kredit-public-v2`, `kredit-offline-v2`.

### Précache (install)

```
/ , /fr, /en, /nl, /de, /fr/offline, /manifest.json, /icons/icon-192.png, /icons/icon-512.png
```

`skipWaiting()` à l’install, `clients.claim()` + `navigationPreload.enable()` à l’activate. Nettoyage des anciens caches `kredit-*` non courants.

### Classification des requêtes

| Stratégie | ID | Quand | Requête |
|-----------|----|-------|---------|
| **STATIC_ASSETS** `CacheFirst` | `STATIC_ASSETS` | `/_next/static/*`, `/_next/image`, `/icons/*`, `/screenshots/*`, `*.js,*.css,*.woff2,*.png,*.svg`, `destination in [style,script,font,image]` | GET same-origin immutable — sert du cache d’abord, met en cache si `200`, TTL 30j, max 100 |
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
STATIC_ASSETS       → CacheFirst        → /_next/static, /icons, fonts
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
