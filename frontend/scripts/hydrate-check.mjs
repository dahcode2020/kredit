#!/usr/bin/env node
/**
 * Vérification d'hydratation sans navigateur (jsdom exécute les vrais chunks client de Next,
 * donc React hydrate réellement le HTML rendu par le serveur).
 *
 *   npm run dev                              # dans un autre terminal (défaut : :3000)
 *   npm i -D jsdom                           # optionnel, non ajouté aux dépendances
 *   node scripts/hydrate-check.mjs                       # /fr /en /nl /de
 *   node scripts/hydrate-check.mjs --base http://localhost:3000 --skew-intl
 *   node scripts/hydrate-check.mjs --routes /fr /credit/simulator --wait 12000
 *   node scripts/hydrate-check.mjs --routes /nl/payments --expect "Klantengedeelte" --forbid "Espace client"
 *
 * `--expect` / `--forbid` sont des regex évaluées sur le texte du DOM **après hydratation** — le seul
 * moyen de contrôler le chrome des coquilles (render only après montage, donc invisible pour `curl`).
 * Attention: passe toujours une route PRÉFIXÉE par la locale. `/notifications` est renvoyé (307) sur
 * `/fr/notifications` par le middleware, et l'attente néerlandaise y échoue pour la mauvaise raison.
 *
 * `--skew-intl` simule le décalage de CLDR entre le runtime Node (serveur) et le navigateur :
 * `Intl` y renvoie U+00A0 là où Node émet U+202F. C'est LA cause de mismatch la plus vicelante
 * (un seul caractère d'espace dans un montant) ; sans normalisation (`lib/intl.ts`), cette
 * option fait échouer le test — avec la normalisation, elle ne change rien.
 *
 * Sortie : code 0 si aucune erreur d'hydratation, 1 sinon (utilisable en CI).
 */
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(process.cwd() + "/");

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = require("jsdom"));
} catch {
  console.error("jsdom introuvable. Installe-le d'abord côté dev : npm i -D jsdom");
  process.exit(2);
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const base = arg("base", "http://localhost:3000");
const waitMs = Number(arg("wait", 9000));
const skewIntl = has("skew-intl");
// Contrôle de CONTENU (en plus de l'hydratation) : le chrome des coquilles est rendu après montage,
// donc `curl` ne le voit jamais. `--expect` / `--forbid` sont des regex évaluées sur le texte du DOM
// hydraté, par route. Exemple: le menu de /nl ne doit plus être en français.
const expectRe = arg("expect", null);
const forbidRe = arg("forbid", null);
const routesIdx = process.argv.indexOf("--routes");
const routes =
  routesIdx > -1
    ? process.argv.slice(routesIdx + 1).filter((a) => a.startsWith("/"))
    : ["fr", "en", "nl", "de"].map((l) => `/${l}`);

const streamWeb = await import("node:stream/web").then((m) => m.default ?? m);

function* none() {}

async function check(url) {
  const collected = [];
  const vc = new VirtualConsole();
  for (const ev of ["error", "warn"]) vc.on(ev, (m) => collected.push(`${ev.toUpperCase()} ${String(m)}`));
  vc.on("jsdomError", (e) => collected.push(`JSDOM ${String(e?.message)}`));

  const dom = await JSDOM.fromURL(url, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      // APIs absentes de jsdom dont le runtime Next/client a besoin
      for (const [k, v] of Object.entries({
        ReadableStream: streamWeb.ReadableStream, WritableStream: streamWeb.WritableStream, TransformStream: streamWeb.TransformStream,
        fetch: globalThis.fetch, Headers: globalThis.Headers, Request: globalThis.Request, Response: globalThis.Response,
        TextEncoder: globalThis.TextEncoder, TextDecoder: globalThis.TextDecoder, structuredClone: globalThis.structuredClone,
      })) {
        try { if (!window[k] && v) window[k] = v; } catch {}
      }
      if (!window.matchMedia) window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      class NOL { observe() {} unobserve() {} disconnect() {} takeRecords() { return none(); } }
      if (!window.IntersectionObserver) window.IntersectionObserver = NOL;
      if (!window.ResizeObserver) window.ResizeObserver = NOL;
      window.scrollTo = () => {};
      try { window.HTMLElement.prototype.scrollIntoView = () => {}; } catch {}

      if (skewIntl) {
        // Navigateur « ancien CLDR » : U+202F → U+00A0 dans les sorties Intl
        const skew = (F) => new Proxy(F, {
          construct(t, a) {
            const o = new t(...a);
            return new Proxy(o, {
              get(oo, k) {
                if (k !== "format") return oo[k];
                const f = oo.format.bind(oo);
                return (v) => String(f(v)).replace(/\u202f/g, "\u00a0");
              },
            });
          },
        });
        try {
          Object.defineProperty(window.Intl, "NumberFormat", { value: skew(window.Intl.NumberFormat), configurable: true, writable: true });
          Object.defineProperty(window.Intl, "DateTimeFormat", { value: skew(window.Intl.DateTimeFormat), configurable: true, writable: true });
        } catch {}
      }
    },
  });

  await new Promise((r) => setTimeout(r, waitMs));

  let hydrated = "unknown";
  try {
    hydrated = dom.window.eval(
      `(function(){var m=document.getElementById('main');if(!m)return 'no-#main';` +
      `return Object.keys(m).some(function(k){return k.indexOf('__reactFiber$')===0||k.indexOf('__reactContainer$')===0})?'hydrated':'NOT-HYDRATED';})()`
    );
  } catch {}

  const issues = collected.filter((m) => /hydrat|did not match|did not agree|server HTML|Text content|Extraneous|validateDOMNesting/i.test(m));

  if (expectRe || forbidRe) {
    let texte = "";
    try { texte = dom.window.document.body.textContent || ""; } catch {}
    texte = texte.replace(/\s+/g, " ");
    if (expectRe && !new RegExp(expectRe).test(texte)) issues.push(`CONTENU ATTENDU ABSENT /${expectRe}/`);
    if (forbidRe) {
      const m = new RegExp(forbidRe).exec(texte);
      if (m) issues.push(`CONTENU INTERDIT PRÉSENT /${forbidRe}/ → « ${String(m[0]).slice(0, 60)} »`);
    }
  }
  try { dom.window.close(); } catch {}
  return { url, hydrated, issues, noise: collected.length };
}

let failures = 0;
for (const route of routes) {
  const url = route.startsWith("http") ? route : `${base}${route}`;
  try {
    const r = await check(url);
    const ok = r.issues.length === 0 && r.hydrated === "hydrated";
    if (!ok) failures++;
    console.log(`${ok ? "✔" : "✖"} ${url}  [${r.hydrated}]${skewIntl ? " skew-CLDR" : ""}`);
    for (const i of r.issues.slice(0, 5)) console.log(`    ${i.slice(0, 220)}`);
    if (r.hydrated !== "hydrated") console.log(`    → la page n'a pas été hydratée : Next tourne-t-il sur ${base} ? (npm run dev)`);
    if (r.issues.some((i) => i.startsWith("CONTENU"))) console.log("    → contenu évalué APRÈS hydratation: une page non hydratée échouera aussi ces tests");
  } catch (e) {
    failures++;
    console.log(`✖ ${url}  ${String(e?.message).slice(0, 200)}`);
  }
}

if (failures) {
  console.error(`\n✖ ${failures} route(s) avec un problème d'hydratation — voir docs/hydration.md\n`);
  process.exit(1);
}
console.log(`\n✔ ${routes.length} route(s) hydratée(s) sans écart serveur/client.\n`);
