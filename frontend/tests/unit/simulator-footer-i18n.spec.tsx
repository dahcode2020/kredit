/**
 * Simulateur, pied de page et codes du moteur — verrous de la passe 10.
 *
 * Trois choses qui n'étaient tenues par rien :
 *
 * 1. les **listes d'options** du simulateur (types de revenus, situations, objets de crédit) étaient écrites
 *    dans le JSX ; le moteur, lui, connaissait déjà ces codes. Un code ajouté au moteur n'avait donc aucun
 *    moyen de réclamer sa traduction. Les listes sortent maintenant de `lib/credit-engine.ts` et ce test
 *    exige une clé dans les quatre dictionnaires pour **chaque** code exporté ;
 * 2. le simulateur affichait des chaînes **fabriquées par le moteur** (explication de score, alertes,
 *    libellés de pièces) — donc françaises sur `/en`, `/nl`, `/de`. Le composant résout désormais
 *    `simulator.warning.<code>` / `documents.<code>` et ne garde le texte du moteur qu'en repli ;
 * 3. le **pied de page** — visible sur les quatre marchés, dans le HTML servi — portait encore sa copie en
 *    dur (« Produits », « Conformité », « Crédit Personnel » avec une majuscule qui ne correspondait à
 *    aucune clé, l'adresse, la ligne de crédit).
 */
import { renderToString } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";
import { locales, t, type Locale } from "@/lib/i18n";
import {
  INCOME_TYPES,
  EMPLOYMENT_STATUSES,
  LOAN_PURPOSES,
  PRODUCT_TYPES,
  SIMULATION_WARNINGS,
  DOCUMENT_CODES,
} from "@/lib/credit-engine";
import Simulator from "@/components/credit/Simulator";
import Footer from "@/components/layout/Footer";

const dict = (loc: string, cle: string) =>
  JSON.parse(readFileSync(join(process.cwd(), `i18n/${loc}/common.json`), "utf8"))[cle] ??
  JSON.parse(readFileSync(join(process.cwd(), `i18n/${loc}/credit.json`), "utf8"))[cle];

const rendu = (l: Locale) => ({
  simulateur: renderToString(<Simulator locale={l} />),
  pied: renderToString(<Footer locale={l} />),
});

describe("codes du moteur de simulation", () => {
  const familles: [string, readonly string[]][] = [
    ["simulator.incomeType", INCOME_TYPES],
    ["simulator.employment", EMPLOYMENT_STATUSES],
    ["simulator.purpose", LOAN_PURPOSES],
    ["simulator.tab", PRODUCT_TYPES],
    ["simulator.warning", SIMULATION_WARNINGS],
    ["documents", DOCUMENT_CODES],
  ];

  it("chaque code exporté par le moteur a sa clé dans les quatre langues", () => {
    const absentes: string[] = [];
    for (const [prefix, codes] of familles) {
      for (const code of codes) {
        const cle = `${prefix}.${code}`;
        for (const loc of locales) {
          const rendu = t(loc, `credit:${cle}`) === cle ? t(loc, cle) : t(loc, `credit:${cle}`);
          if (rendu === cle) absentes.push(`${loc} → ${cle}`);
        }
      }
    }
    expect(absentes).toEqual([]);
  });

  it("les listes font la taille des unions du moteur (pas de code oublié silencieusement)", () => {
    const src = readFileSync(join(process.cwd(), "lib/credit-engine.ts"), "utf8");
    for (const [nom, attendu] of [
      ["IncomeType", INCOME_TYPES.length],
      ["EmploymentStatus", EMPLOYMENT_STATUSES.length],
      ["LoanPurpose", LOAN_PURPOSES.length],
    ] as [string, number][]) {
      const union = new RegExp(`export type ${nom} = ([^;]+);`).exec(src)?.[1] ?? "";
      expect(union.split("|").length).toBe(attendu);
    }
    // Les pièces attendues par les trois produits couvrent l'union des codes connus.
    const codesMoteur = [...src.matchAll(/'(ID|INCOME_3M|PROOF_ADDRESS|PROPERTY_VALUATION|BANK_STATEMENTS_3M|TAX_RETURN_2Y|BUSINESS_PLAN)'/g)].map((m) => m[1]);
    for (const c of new Set(codesMoteur)) expect(DOCUMENT_CODES).toContain(c);
  });
});

describe("simulateur", () => {
  it("les <select> sont peuplés depuis les dictionnaires, pas depuis le JSX", () => {
    const { simulateur: nl } = rendu("nl");
    expect(nl).toContain("Vaste betrekking"); // simulator.employment.CDI
    expect(nl).toContain("Zelfstandige");
    expect(nl).not.toContain("Sans emploi");
    expect(nl).not.toContain(">CDI<");
    const { simulateur: de } = rendu("de");
    expect(de).toContain("Unbefristet");
    expect(de).not.toContain("Indépendant");
  });

  it("les onglets produits viennent des clés, plus de dictionnaire parallèle dans le composant", () => {
    // Commentaires retirés: la raison de l'absence du dictionnaire parallèle est écrite dans le fichier,
    // et un contrôle qui compte les explications comme des violations finit par être retiré.
    const src = readFileSync(join(process.cwd(), "components/credit/Simulator.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/label:\s*\{\s*fr:/);
    expect(src).toContain("simulator.tab.${prod.key}");
    for (const l of locales) expect(t(l, "credit:simulator.tab.MORTGAGE")).not.toBe("credit:simulator.tab.MORTGAGE");
  });

  it("les libellés fabriqués par le moteur sont traduits, avec repli explicite", () => {
    const src = readFileSync(join(process.cwd(), "components/credit/Simulator.tsx"), "utf8");
    expect(src).toContain("const trOu =");
    expect(src).toContain("simulator.warning.${w.code}");
    expect(src).toContain("documents.${d.code}");
    // Le repli ne doit jamais afficher une clé: `trOu` compare à la clé demandée.
    expect(src).toMatch(/return rendu === cle \? fallback : rendu/);
  });

  it("la durée est écrite par la règle de pluriel du marché", () => {
    for (const [l, attendu] of [["fr", "mois"], ["en", "months"], ["nl", "maanden"], ["de", "Monate"]] as [Locale, string][]) {
      expect(t(l, "credit:simulator.months", { term: 48 })).toContain(attendu);
      expect(t(l, "credit:simulator.months", { term: 12 })).toContain(attendu);
    }
  });
});

describe("pied de page", () => {
  it("rend la langue du segment, y compris dans le HTML serveur", () => {
    for (const l of locales) {
      const { pied } = rendu(l);
      expect(pied).toContain(dict(l, "footer.tagline").slice(0, 40));
      expect(pied).toContain(dict(l, "footer.products"));
      expect(pied).toContain(dict(l, "footer.compliance"));
      expect(pied).toContain(dict(l, "footer.address"));
      if (l !== "fr") {
        expect(pied).not.toContain("Produits");
        expect(pied).not.toContain("Conformité");
        expect(pied).not.toContain("Crédit Personnel");
      }
    }
  });

  it("réutilise les noms de produits des dictionnaires au lieu d'une casse maison", () => {
    const { pied } = rendu("fr");
    expect(pied).toContain(dict("fr", "products.personal")); // « Crédit personnel », pas « Crédit Personnel »
    expect(pied).not.toContain("Crédit Personnel");
  });
});
