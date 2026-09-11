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
    description: 'Contenu public non sensible (home, simulateur shell, legal) — stale while revalidate, 24h',
    examples: ['/fr', '/en', '/nl', '/de', '/api/v1/investment-products GET'],
    networkTimeoutSeconds: 3,
  },
  AUTHENTICATED_CONTENT: {
    id: 'AUTHENTICATED_CONTENT',
    strategy: 'NetworkFirst',
    description: 'Pages authentifiées (dashboard, dossiers, profil) — NetworkFirst, pas de cache persistant données perso',
    examples: ['/fr/dashboard', '/fr/credit/*', '/api/v1/customer/*'],
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

export const OFFLINE_FALLBACK_URL = '/fr/offline';

// Inform user when operation requires server
export function requiresServer(strategy: CacheStrategyId): boolean {
  return strategy === 'FINANCIAL_DATA' || strategy === 'AUTHENTICATED_CONTENT';
}
