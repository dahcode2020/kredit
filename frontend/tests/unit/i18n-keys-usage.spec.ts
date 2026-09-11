/**
 * Toute clé demandée par le code existe dans les quatre langues.
 *
 * `t()` ne plante pas sur une clé absente: il retombe sur `fr` (et rend la clé elle-même si elle
 * n'existe nulle part). Sans contrôle, une clé ajoutée pour `fr` uniquement fait donc réapparaître du
 * français sur /en, /nl, /de — exactement le défaut corrigé sur la page d'accueil, mais en plus
 * discret. Ce test énumère les candidats du code (aucun AST, juste des motifs) et vérifie qu'un clé
 * qui se résout quelque part se résout partout.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { locales, t, type Locale } from "@/lib/i18n";
import { estPartagee } from "./translation-exceptions";

const RACINES = ["app", "components", "features", "hooks", "lib"];

function fichiers(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...fichiers(full));
    else if (/\.(tsx|ts)$/.test(e)) out.push(full);
  }
  return out;
}

/** `tr("a.b")`, `t(locale, "a.b")`, `labelKey: "a.b"`, `items: ["a.b", …]` → mêmes motifs: une chaîne entre guillemets qui ressemble à une clé. */
const CLE = /["'`]([a-zA-Z][\w-]*(?:\.[\w-]+)+)["'`]/g;

const candidats = new Map<string, string[]>();
for (const racine of RACINES) {
  for (const f of fichiers(racine)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(CLE)) {
      const cle = m[1];
      if (!/\./.test(cle)) continue;
      if (/\.(png|jpg|jpeg|svg|webp|json|ts|tsx|js|jsx|css|be|com)$/i.test(cle)) continue;
      if (!cle.startsWith("common:") && !/^[a-z]/.test(cle)) continue;
      const liste = candidats.get(cle) ?? [];
      if (liste.length < 3) liste.push(f);
      candidats.set(cle, liste);
    }
  }
}

/**
 * Une clé se « résout » si `t()` rend autre chose que la clé elle-même. On interroge `t(locale, cle)`
 * avec la **forme brute** utilisée par le code: `useTranslation("credit")` préfixe le namespace, les
 * `tr()` de page aussi — même résolution, mêmes fallbacks, donc pas de faux négatifs.
 */
const resout = (loc: Locale, cle: string) => {
  const rendu = t(loc, cle);
  return rendu !== cle && rendu !== undefined && rendu !== "";
};

const brutes = [...new Set([...candidats.keys()])].filter((cle) => !cle.includes(":"));
const clesDuCode = brutes.filter((cle) => resout("fr", cle));

describe("clés i18n utilisées par le code", () => {
  it("le scan trouve bien les clés de la page d'accueil et des coquilles", () => {
    expect(clesDuCode.length).toBeGreaterThan(120);
    for (const c of ["hero.title1", "products.personal.desc", "faq.a1", "shell.logout", "nav.repayments"]) {
      expect(clesDuCode).toContain(c);
    }
  });

  it("toute clé résolue quelque part est résolue dans les quatre langues", () => {
    const cassees: string[] = [];
    for (const cle of clesDuCode) {
      for (const loc of locales) if (!resout(loc, cle)) cassees.push(`${loc} → ${cle}`);
    }
    expect(cassees).toEqual([]);
  });

  it("aucune de ces clés ne rend la même chaîne que le français (sauf endonymes et acronymes)", () => {
    const suspectes: string[] = [];
    for (const cle of clesDuCode) {
      const fr = t("fr", cle);
      if (!/[éèêàâçîïôûùœ]/i.test(fr)) continue; // sans accent: indiscernable d'un loanword
      for (const loc of ["en", "nl", "de"] as Locale[]) {
        if (t(loc, cle) === fr && !estPartagee(cle)) suspectes.push(`${loc} → ${cle}`);
      }
    }
    expect(suspectes).toEqual([]);
  });
});
