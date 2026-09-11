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
/** `data-intl` posé sur <html> hors arbre React: le tag Intl est lu, pas utilisé pour formater. */
const INTL_TAG_ALLOWLIST = new Set(["components/layout/HtmlLang.tsx"]);

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
    why: "Locale implicite = locale du runtime (Node ≠ navigateur). Passer la locale du segment: formatCurrency(v, locale), formatDate(d, locale).",
  },
  {
    // Le piège de la passe 5: `formatEUR2(v, "fr-BE")` dans une page `nl`/`de` (et `locale: "fr_BE"`,
    // `canonical: "/fr"` dans le layout racine, qui ne voit pas les params du segment).
    id: "locale-tag-literal",
    dirs: RENDER_DIRS,
    re: /(["'])(fr|en|nl|de|it|es|pt)[-_](BE|FR|NL|DE|US|GB|CH|CA)\1/gi,
    why: "Tag de locale en dur dans une page/composant: 3 des 4 marchés se retrouvent formatés (ou indexés) comme le français, et le jour où un appelant dérive la locale du segment, serveur et client divergent. Passer la locale du segment — formatEUR2(v, locale), formatCurrency(v, locale) — les tables (localeToIntl, openGraphLocale) vivent dans lib/.",
  },
  {
    id: "locale-arg-literal",
    dirs: RENDER_DIRS,
    // Locale en argument: soit en tête (`t("fr", key)`), soit en dernier (`formatDate(d, "fr")`).
    re: /\b(?:formatDate|formatDateLong|formatDateTime|formatCurrency0?|formatPercent|formatNumber|formatList|formatEUR2?|formatPhoneBE|formatRelative|relativeTime|tNs|t)\s*\(\s*(["'])(fr|en|nl|de)\1|\b(?:formatDate|formatDateLong|formatDateTime|formatCurrency0?|formatPercent|formatNumber|formatList|formatEUR2?|formatPhoneBE|formatRelative|relativeTime)\s*\([^()]*,\s*(["'])(fr|en|nl|de)\3\s*\)/g,
    why: "Locale figée en argument d'un formatteur: le rendu ne suit plus le segment [locale]. Utiliser la variable `locale` de la page (ou useLocale()).",
  },
  {
    // `"/fr/dashboard"` dans le code = une URL qui ne suit pas le segment [locale] (manifeste PWA,
    // pages offline, motifs de cache: trois fuites trouvées comme ça). Un gabarit `/${locale}/…` est
    // licite: seuls les littéraux starting avec un code de langue sont visés.
    id: "localized-url-literal",
    dirs: [...RENDER_DIRS, "lib", "hooks"],
    re: /(["'`])\/(fr|en|nl|de)(?=[/?#]|["'`])/g,
    why: "URL préfixée en dur par une langue dans le code: les trois autres langues héritent d'un lien français (le manifeste PWA faisait atterrir un utilisateur nl sur /fr). Construire `/${locale}/…`, ou écrire le motif `{locale}/…` quand c'est de la documentation.",
  },
  {
    // La copie d'un layout (title/description) est traduite ou n'est pas dans ce fichier.
    id: "untranslated-metadata",
    dirs: ["app"],
    re: /\b(title|description)\s*:\s*(["'])([^"'\n]*)\2/g,
    accept: (m, rel) => {
      if (!/(?:^|\/)app\/.*\/(layout|route)\.(t|j)sx?$/.test(rel) && rel !== "app/layout.tsx") return true;
      return !/\s/.test(m[3]); // "KREDIT" (marque, sans espace) n'est pas de la copie à traduire
    },
    why: "Copie de métadonnée en littéral dans un layout: ce layout est partagé par les quatre langues (ou ne voit pas le segment). Passer par t(locale, \"common:seo.…\") dans `app/[locale]/layout.tsx`.",
  },
  {
    // Liste de locales recopiée dans un composant: la table du projet vit dans lib/locale-detection.
    id: "locale-list-literal",
    dirs: RENDER_DIRS,
    re: /\[\s*(["'])(fr|en|nl|de)\1\s*(?:,\s*(["'])(?:fr|en|nl|de)\3\s*)+\]/g,
    why: "Liste de locales codée en dur dans un composant: `locales`/`supportedLocales` (lib/locale-detection.ts) est la seule source — une copie silencieuse oublie la langue ajoutée après (c'est ainsi qu'un template `fr` se retrouvait exclu d'un aperçu).",
  },
  {
    id: "intl-tag-in-ui",
    dirs: RENDER_DIRS,
    re: /\blocaleToIntl\b/g,
    allowlist: INTL_TAG_ALLOWLIST,
    why: "Un composant ne manipule pas de tag Intl: les formatteurs de lib prennent la locale applicative (fr|en|nl|de) et résolvent le tag eux-mêmes. Revenir à `localeToIntl[locale]` réintroduit la divergence de formats.",
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
        if (rule.accept?.(m, rel)) continue; // motif déterministe ou hors périmètre
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
console.log("✔ check-hydration: aucun motif à risque (APIs navigateur au render, band-aid suppressHydrationWarning, locale implicite, dates sans décalage, temps relatif au render, tables/tag de locale en dur, URL préfixée par une langue, copie de métadonnée non traduite, HTML en cache SW).");
