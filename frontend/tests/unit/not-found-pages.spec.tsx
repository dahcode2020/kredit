/**
 * Pages de secours 404 — le site ne doit jamais finir en page blanche anglaise.
 *
 * Deux trous distincts, tous deux vécus comme « le site disparaît après être apparu » :
 * - `app/[locale]/not-found.tsx` n'était qu'un stub d'une ligne, « Page non trouvée », français
 *   sur les quatre marchés ;
 * - `app/not-found.tsx` n'existait pas du tout, donc une URL hors du segment localisé retombait
 *   sur la page 404 intégrée de Next (une phrase en anglais, aucun moyen d'en sortir).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

const CLEFS = ["shell.notFoundTitle", "shell.notFoundBody", "shell.notFoundHome", "shell.notFoundOther", "shell.notFoundRoot"];
const LANGE = ["fr", "en", "nl", "de"] as const;
let cheminSimule = "/nl/pour-de-vrai-404";
// Nom préfixé `mock` : la factory jest.mock est hoistée et ne peut référencer qu'ainsi une variable du module.
let mockCookieLocale: string | undefined;

jest.mock("next/navigation", () => ({
  usePathname: () => cheminSimule,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("next/link", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ href, children, ...rest }: any) =>
      React.createElement("a", { href: typeof href === "string" ? href : "/", ...rest }, children),
  };
});
jest.mock("next/headers", () => ({
  cookies: () => ({ get: (nom: string) => (nom === "NEXT_LOCALE" ? { value: mockCookieLocale } : undefined) }),
}));

import LocaleNotFound from "@/app/[locale]/not-found";
import RootNotFound from "@/app/not-found";

async function monter(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | undefined;
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });
  return {
    texte: () => container.textContent ?? "",
    liens: () => Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href")),
    disposer: async () => {
      await act(async () => root?.unmount());
      container.remove();
    },
  };
}

describe("pages de secours 404", () => {
  it("les cinq clés existent dans les quatre dictionnaires et ne dupliquent pas le français", () => {
    const dicts: Record<string, Record<string, string>> = Object.fromEntries(
      LANGE.map((l) => [l, JSON.parse(readFileSync(join(process.cwd(), `i18n/${l}/common.json`), "utf8"))])
    ) as any;
    for (const cle of CLEFS) {
      for (const l of LANGE) expect(dicts[l][cle]).toBeTruthy();
      for (const l of LANGE.filter((x) => x !== "fr")) expect(dicts[l][cle]).not.toBe(dicts.fr[cle]);
    }
  });

  it("le panneau localisé garde la langue de l'URL et propose les quatre langues", async () => {
    cheminSimule = "/nl/pour-de-vrai-404";
    const m = await monter(<LocaleNotFound />);
    expect(m.texte()).toContain("Pagina niet gevonden");
    expect(m.texte()).not.toMatch(/Page non trouvée|Page introuvable/);
    expect(m.liens()).toEqual(expect.arrayContaining(["/nl", "/fr", "/en", "/de"]));
    await m.disposer();

    cheminSimule = "/de/admin/kyc/quelque-chose-de-trop-long";
    const d = await monter(<LocaleNotFound />);
    expect(d.texte()).toContain("Seite nicht gefunden");
    expect(d.liens()[0]).toBe("/de");
    await d.disposer();
  });

  it("le stub français d'une ligne a disparu du fichier", () => {
    const src = readFileSync(join(process.cwd(), "app/[locale]/not-found.tsx"), "utf8");
    expect(src).not.toMatch(/>\s*Page non trouvée\s*</);
    expect(src).toMatch(/t\(locale, `common:\$\{cle\}`\)/);
  });

  it("la page de secours racine se rend dans la langue du cookie, avec issue", () => {
    mockCookieLocale = "de";
    const html = renderToString(<RootNotFound />);
    expect(html).toContain("Seite nicht gefunden");
    expect(html).toContain('lang="de"');
    expect(html).toContain("/de");
    expect(html).not.toMatch(/This page could not be found/);

    mockCookieLocale = undefined;
    const repli = renderToString(<RootNotFound />);
    expect(repli).toContain('lang="fr"');
    expect(repli).toContain("Page introuvable");
    // Les quatre langues restent proposées même sans cookie: c'est la seule issue de la page.
    for (const l of LANGE) expect(repli).toContain(`/${l}`);
  });

  it("les quatre fichiers de secours sont présents (le garde-fou le vérifie aussi)", () => {
    for (const f of ["app/not-found.tsx", "app/[locale]/not-found.tsx", "app/[locale]/error.tsx", "app/global-error.tsx"]) {
      expect(readFileSync(join(process.cwd(), f), "utf8").length).toBeGreaterThan(200);
    }
  });
});
