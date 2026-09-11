#!/usr/bin/env node
/**
 * Budget de copie non traduite (zéro dépendance).
 *
 *   node scripts/check-copy.mjs              → exit 1 si un fichier dépasse son budget
 *   node scripts/check-copy.mjs --update     → recalcule le budget (après une traduction)
 *   node scripts/check-copy.mjs --report     → liste les pires fichiers, sans contrôler
 *
 * Pourquoi un budget et pas une interdiction : l'app a été écrite en français, puis traduite par
 * strates. Interdire d'un coup signifierait 150+ chaînes à livrer dans un seul commit, donc un
 * commit impossible à relire. Le budget est **décroissant** : aucune ligne nouvelle de copie française
 * ne passe, et chaque traduction fait baisser la ligne correspondante du fichier d'étalonnage.
 *
 * Pourquoi les coquilles sont à 0 (`FLOOR_DIRS`) : `components/customer/*` et `components/admin/*`
 * enveloppent toutes les pages métier. Leur copie était en dur → un utilisateur `nl` avait une page
 * traduite dans un menu français. Ces deux répertoires sont donc **interdits** de copie en dur, pas
 * budgétés.
 *
 * Heuristique (délibérément conservatrice) : une « ligne de copie » = une ligne de JSX (hors commentaire)
 * contenant du texte visible de ≥ 2 mots avec au moins un caractère accentué, ou un littéral de chaîne
 * dans ce cas. Les classNames Tailwind, URL, chemins et identifiants sont exclus, idem les lignes qui
 * font déjà suivre la langue au texte (`locale === … ? … : …`) — traduites, mais hors dictionnaires.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const BASELINE = join(ROOT, "scripts", "copy.baseline.json");
const SCAN_DIRS = ["app", "components", "features"];
const FLOOR_DIRS = ["components/customer", "components/admin"];
/**
 * Fichiers passés à zéro, maintenus à zéro (règle dure, pas de budget). La page d'accueil y est
 * depuis que toute sa copie est dans les dictionnaires : son texte est rendu **côté serveur** dans la
 * langue du segment, donc une chaîne qui y repasserait en dur se retrouve littéralement dans le HTML
 * des trois autres langues (index, partages, SEO) — contrairement au reste des pages, invisible
 * jusqu'à l'hydratation.
 */
const FLOOR_FILES = ["app/[locale]/page.tsx"];

const ACCENTUE = /[éèêëàâäçîïôöûùüœ]/i;
const BRUIT = /(className|style=|href=|src=|url\(|\bpx-|\bpy-|\bmt-|\bmb-|rounded|bg-[a-z]|\btext-(xs|sm|base|lg|xl|\[)|grid|flex|w-\d|h-\d|min-|max-|border|shadow|animate|tracking-|leading-|opacity|pointer-events|select-none|place-items|divide-|sticky|inset|z-\d|overflow|hover:|focus:|disabled:|last:|sm:|md:|lg:)/;

function fichiers(dir) {
  const out = [];
  const base = join(ROOT, dir);
  if (!existsSync(base)) return out;
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx|jsx)$/.test(e)) out.push(full);
    }
  };
  walk(base);
  return out;
}

const clean = (line) => line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");

/** Lignes de copie française d'un fichier. */
function copie(texte) {
  const hits = [];
  texte.split("\n").forEach((raw, i) => {
    const line = clean(raw);
    if (!line.trim()) return;
    const candidats = [
      ...[...line.matchAll(/>([^<>{}\n]{3,})</g)].map((m) => m[1]),      // texte JSX
      ...[...line.matchAll(/(["'])((?:(?!\1)[^\\\n]){6,})\1/g)].map((m) => m[2]), // littéraux
    ];
    const ok = candidats.find((c) => {
      const s = c.replace(/&[a-z]+;/gi, " ").trim();
      if (s.split(/\s+/).length < 2) return false;
      if (!ACCENTUE.test(s)) return false;
      if (BRUIT.test(s)) return false;
      // Copie déjà multilingue gérée dans le JSX (`locale === "nl" ? … : …`) : traduite, juste pas
      // par les dictionnaires. La signaler produirait de faux positifs que l'on apprendrait à ignorer.
      if (/\b(locale|lang)\s*[=!]==?/.test(line)) return false;
      return !/^[a-z0-9_\-./:#?&=,%+]+$/i.test(s); // un chemin, une URL ou un identifiant
    });
    if (ok) hits.push({ line: i + 1, texte: ok.replace(/\s+/g, " ").trim().slice(0, 78) });
  });
  return hits;
}

const rapport = () => {
  const par = new Map();
  for (const dir of SCAN_DIRS) {
    for (const f of fichiers(dir)) {
      const hits = copie(readFileSync(f, "utf8"));
      if (hits.length) par.set(relative(ROOT, f).split("\\").join("/"), hits);
    }
  }
  return par;
};

const budget = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};
const budgetDe = (f) => (FLOOR_DIRS.some((d) => f.startsWith(d + "/")) || FLOOR_FILES.includes(f) ? 0 : (budget[f] ?? 0));

const args = process.argv.slice(2);
const rel = rapport();

// `--show <fichier>`: liste les lignes comptées, sans faire échouer le build. Indispensable pour
// savoir ce qui RESTE à traduire dans un fichier donné (le budget dit « combien », pas « quoi »).
const showIdx = args.indexOf("--show");
if (showIdx > -1) {
  const cible = args[showIdx + 1];
  const trouvee = [...rel.entries()].filter(([f]) => !cible || f.includes(cible));
  if (!trouvee.length) { console.log(`aucune copie française comptée pour ${cible ?? "(aucun filtre)"}`); process.exit(0); }
  for (const [f, hits] of trouvee) {
    console.log(`\n${f} — ${hits.length} ligne(s) [budget ${budgetDe(f)}]`);
    for (const h of hits) console.log(`  ${String(h.line).padStart(4)}: ${h.texte}`);
  }
  process.exit(0);
}

if (args.includes("--update")) {
  const out = {};
  for (const dir of SCAN_DIRS) for (const [f, hits] of rel) {
    if (!f.startsWith(dir + "/")) continue;
    if (FLOOR_FILES.includes(f) && !hits.length) continue; // zéro durable: pas la peine d'encombrer le budget
    out[f] = hits.length;
  }
  writeFileSync(BASELINE, JSON.stringify(out, null, 2) + "\n");
  console.log(`✔ copy.baseline.json écrit: ${Object.keys(out).length} fichier(s), ${[...rel.values()].reduce((a, h) => a + h.length, 0)} ligne(s) de copie non traduite.`);
  process.exit(0);
}

if (args.includes("--report")) {
  const tri = [...rel.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [f, hits] of tri.slice(0, 20)) console.log(`${String(hits.length).padStart(3)}  ${f}`);
  console.log(`total: ${[...rel.values()].reduce((a, h) => a + h.length, 0)} ligne(s) dans ${rel.size} fichier(s)`);
  process.exit(0);
}

const erreurs = [];

for (const [f, hits] of rel) {
  const plancher = budgetDe(f);
  if (hits.length > plancher) {
    erreurs.push(
      `${f}: ${hits.length} ligne(s) de copie française pour un budget de ${plancher}\n` +
      hits.slice(0, plancher + 4).map((h) => `    ${h.line}: ${h.texte}`).join("\n") +
      (hits.length > plancher + 4 ? `\n    … ${hits.length - plancher - 4} autre(s)` : "")
    );
  }
}
for (const f of Object.keys(budget)) {
  if (!rel.has(f) && budget[f] > 0) {
    console.log(`ℹ ${f}: la copie française a disparu (${budget[f]} → 0) — penser à ` + `\`node scripts/check-copy.mjs --update\`.`);
  }
}

if (erreurs.length) {
  console.error(`\n✖ copie non traduite au-dessus du budget (${erreurs.length} fichier(s)):\n`);
  console.error(erreurs.join("\n\n"));
  console.error(`\nLes répertoires ${FLOOR_DIRS.join(", ")} (coquilles vues par les 4 langues) sont à zéro.`);
  console.error("Traduire = ajouter la clé dans les 4 dictionnaires (`i18n/{fr,en,nl,de}/*.json`) puis `t(locale, \"ns:cle\")`.");
  console.error("Après une traduction: `node scripts/check-copy.mjs --update` (le budget ne peut que baisser).\n");
  process.exit(1);
}
console.log(`✔ check-copy: aucune copie française nouvelle (budget par fichier respecté, coquilles et ${FLOOR_FILES.length} fichier(s) à zéro).`);
