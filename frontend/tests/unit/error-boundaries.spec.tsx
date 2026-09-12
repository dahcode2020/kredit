/**
 * Frontières d'erreur — le site ne doit plus jamais devenir blanc.
 *
 * Sans `app/[locale]/error.tsx` ni `app/global-error.tsx`, une exception levée côté client
 * démonte l'arbre React entier: la page s'affiche puis disparaît, sans message ni échappatoire.
 * Ce fichier verrouille (1) l'existence des deux fichiers, (2) leur copie traduite sur quatre
 * langues, (3) le comportement réel au montage, (4) le garde-fou `check-routes`.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

jest.mock("next/navigation", () => ({
  usePathname: () => "/nl/credit/simulator",
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

import LocaleError from "@/app/[locale]/error";

const RACINE = process.cwd();
const LANGE = ["fr", "en", "nl", "de"] as const;
const CLES = ["shell.errorTitle", "shell.errorBody", "shell.errorRetry", "shell.errorHome", "shell.errorDevHint", "shell.errorGlobalTitle", "shell.errorGlobalBody"];

async function monter(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | undefined;
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });
  return { container, disposer: async () => { await act(async () => root?.unmount()); container.remove(); } };
}

describe("frontières d'erreur", () => {
  it("les deux fichiers existent, avec reset() branché et copie uniquement via t()", () => {
    for (const f of ["app/[locale]/error.tsx", "app/global-error.tsx"]) {
      const plein = join(RACINE, f);
      expect(existsSync(plein)).toBe(true);
      const src = readFileSync(plein, "utf8");
      expect(src).toContain('"use client"');
      expect(src).toMatch(/reset\s*[=:]/);
      expect(src).toMatch(/onClick=\{reset\}/);
      // Toute la copie passe par le dictionnaire: aucune chaîne accentuée en dur dans le corps.
      const corps = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      expect(corps).toMatch(/t\(locale, `common:\$\{cle\}`\)/);
      expect(corps).not.toMatch(/["'`][^"'`\n]*[éèêàâçîïôûùœ][^"'`\n]*["'`]/);
    }
  });

  it("les sept clés existent dans les quatre dictionnaires et ne dupliquent pas le français", () => {
    const dicts: Record<string, Record<string, string>> = Object.fromEntries(
      LANGE.map((l) => [l, JSON.parse(readFileSync(join(RACINE, `i18n/${l}/common.json`), "utf8"))])
    ) as any;
    for (const cle of CLES) {
      for (const l of LANGE) expect(dicts[l][cle]).toBeTruthy();
      for (const l of LANGE.filter((x) => x !== "fr")) {
        expect(dicts[l][cle]).not.toBe(dicts.fr[cle]);
      }
    }
  });

  it("le panneau se monte dans la langue de l'URL, sans français résiduel, et reset() est branché", async () => {
    const reset = jest.fn();
    const { container, disposer } = await monter(
      <LocaleError error={Object.assign(new Error("boom"), { digest: "abc123" })} reset={reset} />
    );
    const texte = container.textContent ?? "";
    expect(texte).toContain("Een actie is mislukt"); // nl, via usePathname mocké
    expect(texte).not.toMatch(/Une action a échoué/);
    const bouton = Array.from(container.querySelectorAll("button")).find((b) => (b.textContent ?? "").includes("Opnieuw proberen"));
    expect(bouton).toBeTruthy();
    await act(async () => {
      bouton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(reset).toHaveBeenCalledTimes(1);
    // Le lien de repli ramène à l'accueil dans la même langue.
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/nl");
    await disposer();
  });

  it("le détail technique n'apparaît qu'en développement", async () => {
    const nodeEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const prod = await monter(<LocaleError error={Object.assign(new Error("fuite interne"), { digest: "d1" })} reset={jest.fn()} />);
    expect(prod.container.textContent ?? "").not.toContain("fuite interne");
    await prod.disposer();
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    const dev = await monter(<LocaleError error={Object.assign(new Error("fuite interne"), { digest: "d1" })} reset={jest.fn()} />);
    expect(dev.container.textContent ?? "").toContain("fuite interne");
    await dev.disposer();
    (process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv;
  });

  it("check-routes: aucune cible interne morte dans le dépôt", () => {
    const sortie = execFileSync("node", [join(RACINE, "scripts/check-routes.mjs")], { encoding: "utf8" });
    expect(sortie).toContain("toutes résolues");
  });
});
