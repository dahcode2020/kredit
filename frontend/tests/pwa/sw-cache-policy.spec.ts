/**
 * @jest-environment node
 */
/**
 * Politique de cache du service worker — exécutée pour de vrai.
 *
 * Le contrat: le worker ne doit JAMAIS écrire en cache une réponse dont l'URL ne porte pas de
 * hash de build. `/_next/static/chunks/webpack.js` (et `main-dev.js`, `app/…/page.js`,
 * `/_next/webpack-hmr`) est réécrit à chaque compilation: le servir depuis CacheFirst fige un
 * runtime webpack pendant que les chunks viennent d'une compile plus récente, et le navigateur
 * lève « TypeError: Cannot read properties of undefined (reading 'call') » (options.factory).
 * Les anciens tests de ce dossier vérifiaient un objet déclaré en dur dans la spec — ils
 * passaient que le worker casse ou non. Celle-ci charge le vrai `public/sw.js`.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8');

type Ecriture = { cache: string; url: string };

function chargerWorker(reponse: (url: string) => Response) {
  const ecritures: Ecriture[] = [];
  const listeners: Record<string, (event: any) => void> = {};
  const store = new Map<string, Response>();

  const ouvrirCache = (nom: string) => ({
    put: async (req: any, res: Response) => {
      const url = typeof req === 'string' ? req : req.url;
      ecritures.push({ cache: nom, url });
      store.set(`${nom}|${url}`, res);
    },
    add: async () => {},
    addAll: async () => {},
    match: async (req: any) => store.get(`${nom}|${typeof req === 'string' ? req : req.url}`),
  });

  const ctx: any = {
    console: { warn: () => {}, log: () => {}, error: () => {} },
    URL,
    URLSearchParams,
    Promise,
    Response,
    Request,
    Headers,
    AbortController,
    TextEncoder,
    Math,
    JSON,
    Date,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    fetch: async (req: any) => reponse(typeof req === 'string' ? req : req.url),
    caches: {
      open: async (nom: string) => ouvrirCache(nom),
      match: async (req: any) => store.get(`*|${typeof req === 'string' ? req : req.url}`),
      keys: async () => [],
      delete: async () => true,
    },
    self: {
      addEventListener: (type: string, cb: (event: any) => void) => {
        listeners[type] = cb;
      },
      location: new URL('http://localhost:3000/sw.js'),
      registration: { navigationPreload: undefined, showNotification: async () => {} },
      clients: { matchAll: async () => [], claim: async () => {} },
    },
  };
  ctx.globalThis = ctx;

  vm.runInNewContext(SOURCE, ctx, { filename: 'sw.js', timeout: 10000 });

  const intercepte = async (url: string, init: Partial<Record<string, unknown>> = {}) => {
    const req = {
      url: new URL(url, 'http://localhost:3000').href,
      method: 'GET',
      mode: 'no-cors',
      destination: 'script',
      cache: 'default',
      headers: new Headers(),
      ...init,
    };
    const captures: Array<Promise<Response> | Response> = [];
    await listeners.fetch({
      request: req,
      preloadResponse: Promise.resolve(undefined),
      respondWith: (r: Promise<Response> | Response) => {
        captures.push(r);
      },
      waitUntil: () => {},
    });
    if (!captures.length) return { interceptee: false as const, statut: 0, ecritures };
    const res = await captures[0];
    return { interceptee: true as const, statut: res.status, ecritures };
  };

  return { intercepte, ecritures };
}

const reponse = (corps: string, cacheControl: string, contentType = 'application/javascript') =>
  new Response(corps, { status: 200, headers: { 'content-type': contentType, 'cache-control': cacheControl } });

describe('sw.js — le cache ne doit jamais geler un chunk non haché', () => {
  it('laisse filer les chunks de dev (URL stable, pas de respondWith)', async () => {
    const { intercepte } = chargerWorker(() => reponse('console.log("dev")', 'no-store, must-revalidate'));
    for (const url of [
      '/_next/static/chunks/webpack.js',
      '/_next/static/chunks/main-dev.js',
      '/_next/static/chunks/_app.js',
      '/_next/static/development/_buildManifest.js',
      '/_next/webpack-hmr',
    ]) {
      const res = await intercepte(url);
      expect({ url, ...res }).toEqual({ url, interceptee: false, statut: 0, ecritures: [] });
    }
  });

  it('met bien en cache les assets hachés de production (sinon le PWA ne sert plus rien hors ligne)', async () => {
    const { intercepte, ecritures } = chargerWorker(() =>
      reponse('console.log("prod")', 'public, max-age=31536000, immutable')
    );
    const js = await intercepte('/_next/static/chunks/main-4c9c1e9bb24fb188.js');
    expect(js.interceptee).toBe(true);
    expect(js.statut).toBe(200);
    const css = await intercepte('/_next/static/css/2aa1e6b2a8c8b4c4.css', { destination: 'style' });
    expect(css.interceptee).toBe(true);
    expect(ecritures.map((e) => e.url)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('main-4c9c1e9bb24fb188.js'),
        expect.stringContaining('2aa1e6b2a8c8b4c4.css'),
      ])
    );
  });

  it('refuse d’écrire une réponse que le serveur déclare non durable, même sur une URL hachée', async () => {
    const { intercepte, ecritures } = chargerWorker(() => reponse('x', 'no-store'));
    await intercepte('/_next/static/chunks/main-4c9c1e9bb24fb188.js');
    await intercepte('/icons/icon-512.png', { destination: 'image' });
    expect(ecritures).toEqual([]);
  });

  it('ne met jamais en cache une page HTML (document ou payload RSC)', async () => {
    const { intercepte, ecritures } = chargerWorker(() => reponse('<!doctype html><html></html>', 'public, max-age=3600', 'text/html; charset=utf-8'));
    await intercepte('/fr', { mode: 'navigate', destination: 'document' });
    await intercepte('/nl/offline?_rsc=1', { destination: '' });
    expect(ecritures).toEqual([]);
  });

  it('les données financières restent NetworkOnly', async () => {
    const { intercepte, ecritures } = chargerWorker(() => reponse('{}', 'public, max-age=3600', 'application/json'));
    const r = await intercepte('/api/v1/payments', { method: 'POST' });
    expect(r.ecritures).toEqual([]);
    const g = await intercepte('/api/v1/credit/simulations');
    expect(g.ecritures).toEqual([]);
  });
});
