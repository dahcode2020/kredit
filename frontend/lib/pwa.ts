// KREDIT PWA — cache strategies & helpers
export const CACHE_STRATEGIES = {
  STATIC_ASSETS: {
    id: 'STATIC_ASSETS',
    strategy: 'CacheFirst',
    description: 'Assets immuables (_next/static, icons, fonts) — cache long, expiration 30j',
    examples: ['/_next/static/*', '/icons/*', '/*.woff2'],
    maxEntries: 100,
    maxAgeSeconds: 30 * 24 * 60 * 60,
  },
  PUBLIC_CONTENT: {
    id: 'PUBLIC_CONTENT',
    strategy: 'StaleWhileRevalidate',
    description:
      'Contenu public non sensible — SWR appliqué uniquement aux ressources non-HTML. Les documents (et payloads RSC) ne sont JAMAIS servis depuis un cache tant que le réseau répond: un HTML périmé avec des chunks JS neufs provoque « Hydration failed because the initial UI does not match ».',
    examples: ['/icons/*', '/*.webp', '/api/v1/investment-products GET'],
    networkTimeoutSeconds: 3,
    neverCacheHtml: true,
  },
  AUTHENTICATED_CONTENT: {
    id: 'AUTHENTICATED_CONTENT',
    strategy: 'NetworkFirst',
    description: 'Pages authentifiées (dashboard, dossiers, profil) — NetworkFirst, pas de cache persistant données perso',
    examples: ['/{locale}/dashboard', '/{locale}/credit/*', '/api/v1/customer/*'], // {locale} = fr|en|nl|de
    networkTimeoutSeconds: 5,
    neverCacheJson: true,
  },
  FINANCIAL_DATA: {
    id: 'FINANCIAL_DATA',
    strategy: 'NetworkOnly',
    description: 'Données financières sensibles (paiements, crédit, investissements POST, documents) — jamais en cache offline, toujours serveur',
    examples: ['/api/v1/payments', '/api/v1/credit/**', 'POST /investments'],
    cache: 'no-store',
  },
} as const;

export type CacheStrategyId = keyof typeof CACHE_STRATEGIES;

export function getCacheStrategyForRequest(req: { url: string; method?: string; mode?: string }): CacheStrategyId {
  const url = new URL(req.url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (req.method && req.method !== 'GET') return 'FINANCIAL_DATA';
  if (url.pathname.startsWith('/api/')) return 'FINANCIAL_DATA';
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons/') || /\.(js|css|woff2?)$/.test(url.pathname)) return 'STATIC_ASSETS';
  if (/^\/(fr|en|nl|de)\/(dashboard|credit|payments|investments|profile|security|admin|super)/.test(url.pathname)) return 'AUTHENTICATED_CONTENT';
  return 'PUBLIC_CONTENT';
}

/**
 * Page offline par locale: `/public/sw.js` sert `/${locale}/offline` (les quatre sont precachees) ;
 * l'ancienne constante `/fr/offline` figeait la langue du visiteur sur le francais et n'etait de
 * toute facon lue nulle part. Le repli n'est utilise que si la locale demandee n'est pas en cache.
 */
export const OFFLINE_DEFAULT_LOCALE = "fr";
export function offlineFallbackUrl(locale?: string | null) {
  return `/${locale || OFFLINE_DEFAULT_LOCALE}/offline`;
}

// Inform user when operation requires server
export function requiresServer(strategy: CacheStrategyId): boolean {
  return strategy === 'FINANCIAL_DATA' || strategy === 'AUTHENTICATED_CONTENT';
}
