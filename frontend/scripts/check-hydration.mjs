#!/usr/bin/env node
/**
 * Garde-fou anti-hydratation (zéro dépendance).
 *
 *   node scripts/check-hydration.mjs      → exit 1 si une règle est violée
 *
 * Contexte: « Error: Hydration failed because the initial UI does not match what was
 * rendered on the server » (Next.js App Router). La cause est toujours le PREMIER rendu
 * client qui diffère du HTML du serveur. Les motifs ci-dessous sont interdits: ils
 * produisent cet erreur à coup sûr, et sont détectables mécaniquement.
 *
 * Docs & patterns corrects: docs/hydration.md
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const RENDER_DIRS = ["app", "components", "features"];            // code qui produit du JSX
const ALL_DIRS = [...RENDER_DIRS, "hooks", "lib", "services"];    // code appelé pendant un render

/** Exceptions justifiées (documentées dans docs/hydration.md). */
const HYDRATION_WARNING_ALLOWLIST = new Set(["app/layout.tsx"]); // <html lang> muté hors React

const RULES = [
  {
    id: "client-api-in-state",
    dirs: ALL_DIRS,
    re: /useState(?:<[^>]*>)?\(\s*(?:\(\)\s*=>)?[^)\n]*\b(window|document|localStorage|sessionStorage|navigator|Notification|matchMedia|Math\.random\(\)|new Date\(\)|Date\.now\(\))/g,
    why: "State initial lu côté navigateur seulement → serveur et premier rendu client divergent (mismatch). À lire dans un useEffect.",
  },
  {
    id: "render-branch-on-window",
    dirs: RENDER_DIRS,
    // `if (typeof window …) { return <X/> }` dans du JSX = deux arbres selon l'environnement
    re: /typeof\s+(window|document)\b[^\n]*\n?[^\n]*\breturn\s*</g,
    why: "Un composant qui rend un arbre différent selon `typeof window` casse l'hydratation. Rendre le même arbre, puis ajuster dans un effect.",
  },
  {
    id: "implicit-locale",
    dirs: ALL_DIRS,
    re: /\.(toLocaleString|toLocaleDateString|toLocaleTimeString)\(\s*\)|new Intl\.(NumberFormat|DateTimeFormat|RelativeTimeFormat|ListFormat)\(\s*undefined/g,
    why: "Locale implicite = locale du runtime (Node ≠ navigateur). Passer une locale explicite, ex. localeToIntl[locale].",
  },
  {
    // Les espaces sortis du CLDR du runtime (U+202F côté Node vs U+00A0 côté navigateur)
    // suffisent à casser l'hydratation: tout formatage passe par lib/formatters.ts | lib/utils.ts.
    id: "raw-intl-outside-lib",
    dirs: RENDER_DIRS,
    re: /new\s+Intl\.\w+Format\(|\.toLocale(?:String|DateString|TimeString)\(/g,
    why: "Intl/toLocale* en dur dans un composant : espacement dépendant du runtime → mismatch serveur/navigateur. Utiliser formatCurrency/formatDate/formatEUR (normalisés via lib/intl.ts).",
  },
  {
    // `new Date("2026-09-09 14:22")` = temps LOCAL côté moteur de JS: serveur UTC et
    // navigateur +02:00 ne renvoient pas le même instant → dates différentes → mismatch.
    id: "raw-date-parse",
    dirs: RENDER_DIRS,
    // Seules les chaînes SANS décalage sont dangereuses : « …Z », « …+02:00 » et « jour seul »
    // sont définis par la spec (UTC), donc identiques entre serveur et navigateur.
    re: /new\s+Date\s*\(\s*(["'`])([^"'`\n]*)\1/g,
    accept: (m) => /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(m[2]) || /^\d{4}-\d{2}-\d{2}$/.test(m[2]),
    why: "Chaîne de date sans décalage horaire analysée dans un composant : le rendu dépend du fuseau du runtime (UTC serveur vs heure locale navigateur). Écrire le décalage (…+02:00) ou passer par resolveDate()/formatDate(…, locale) de lib/formatters.",
  },
  {
    // Lit Date.now() au moment de l'appel → texte différent entre serveur et client.
    id: "relative-time-in-render",
    dirs: RENDER_DIRS,
    re: /\bformatRelative\s*\(/g,
    why: "formatRelative() lit Date.now() à l'appel: à remplacer par <RelativeTime date locale now /> (composant) ou relativeTime(date, now, locale) avec un `now` fourni par le serveur.",
  },
  {
    id: "hydration-bandaid",
    dirs: RENDER_DIRS,
    re: /suppressHydrationWarning/g,
    why: "N'agit QUE sur l'élément lui-même, jamais sur ses enfants: masque l'erreur sans la corriger. Traiter la source (docs/hydration.md).",
    allowlist: HYDRATION_WARNING_ALLOWLIST,
  },
];

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(tsx|ts)$/.test(e)) yield p;
  }
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

/**
 * Ne pas matcher dans les commentaires (les explications sur `suppressHydrationWarning`
 * sont justement écrites dans le code…). Les newlines sont conservées pour que les
 * numéros de ligne restent exacts.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'\\])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));

const problems = [];

for (const dir of ALL_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).split("\\").join("/");
    const src = stripComments(readFileSync(file, "utf8"));
    for (const rule of RULES) {
      if (!rule.dirs.some((d) => rel === d || rel.startsWith(`${d}/`))) continue;
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(src))) {
        if (rule.allowlist?.has(rel)) continue;
        if (rule.accept?.(m)) continue; // motif déterministe: aucun risque d'hydratation
        problems.push({ rel, line: lineOf(src, m.index), match: m[0].trim().replace(/\s+/g, " ").slice(0, 100), why: rule.why, rule: rule.id });
      }
    }
  }
}

// --- Service worker: un document HTML en cache = hydratation cassée au déploiement suivant
const SW_FILE = "public/sw.js";
try {
  const sw = readFileSync(join(ROOT, SW_FILE), "utf8");
  const precache = sw.match(/const PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  for (const entry of precache.match(/['"][^'"]+['"]/g) ?? []) {
    const url = entry.replace(/['"]/g, "");
    if (/\.[a-z0-9]+$/i.test(url) || /\/offline$/.test(url)) continue; // asset immuable ou page offline: OK
    problems.push({
      rel: SW_FILE, line: lineOf(sw, sw.indexOf(entry)), match: `precache ${url}`,
      why: "Un document HTML precaché devient périmé au déploiement suivant alors que les chunks JS sont neufs → hydration mismatch. Precacher uniquement assets immuables + page /offline.",
      rule: "sw-cached-document",
    });
  }
} catch { /* pas de sw.js → rien à vérifier */ }

if (problems.length) {
  console.error(`\n✖ ${problems.length} risque(s) d'hydratation détecté(s):\n`);
  for (const p of problems) console.error(`  ${p.rel}:${p.line}  [${p.rule}]\n    ${p.match}\n    → ${p.why}\n`);
  console.error("Patterns corrects: docs/hydration.md\n");
  process.exit(1);
}
console.log("✔ check-hydration: aucun motif à risque (APIs navigateur au render, band-aid suppressHydrationWarning, locale implicite, HTML en cache SW).");
