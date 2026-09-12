/**
 * Copie des coquilles applicatives (customer + admin) — verrou de la passe 7.
 *
 * `components/customer/CustomerShell.tsx` et `components/admin/AdminShell.tsx` enveloppent **toutes**
 * les pages métier. Leur navigation, leurs écrans d'accès et leurs bandeaux étaient écrits en dur en
 * français : un utilisateur `nl` ou `de` avait une page traduite dans un menu français. Ces composants
 * rendent un skeleton tant que le store `persist` n'a pas parlé (le HTML serveur ne contient donc
 * aucune copie) : le contrôle se fait sur un montage réel, en passant par le bouton de connexion démo
 * que le shell affiche lui-même.
 */
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt?: string }) => <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} />,
}));

import { Locale, locales, t } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import CustomerShell from "@/components/customer/CustomerShell";
import AdminShell from "@/components/admin/AdminShell";

const tr = (l: Locale, key: string, vars?: Record<string, any>) => t(l, `common:${key}`, vars);
const NAV_CLIENT = ["nav.dashboard", "nav.credit", "nav.applications", "nav.repayments", "nav.payments", "nav.settings"];

/** Le store d'auth est un singleton de module: sans reset, la connexion du test 1 fausse le test 2. */
function deconnecter() {
  useAuth.setState({ user: null, accessToken: null, refreshToken: null, _hasHydrated: false });
  localStorage.clear();
}

async function monter(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | undefined;
  await act(async () => {
    const r = createRoot(container);
    root = r;
    r.render(element);
  });
  return {
    container,
    text: () => container.textContent ?? "",
    /** Clique le bouton dont le libellé (localisé) contient `label` — c'est ainsi qu'on passe la porte. */
    async cliquer(label: string) {
      const btn = [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(label));
      if (!btn) throw new Error(`bouton introuvable: « ${label} » — rendu: ${container.textContent?.slice(0, 160)}`);
      await act(async () => { btn.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    },
    async disposer() {
      await act(async () => root?.unmount());
      container.remove();
    },
  };
}

beforeEach(deconnecter);
afterEach(deconnecter);

describe("CustomerShell — navigation et écran d'accès dans la langue du segment", () => {
  it.each([...locales])("/%s — la nav suit la locale", async (locale: Locale) => {
    const shell = await monter(<CustomerShell locale={locale}><span>contenu</span></CustomerShell>);
    try {
      // 1) écran « non connecté », visible sans authentification
      expect(shell.text()).toContain(tr(locale, "shell.gateTitle"));
      expect(shell.text()).toContain(tr(locale, "shell.gatePreview"));
      expect(shell.text()).toContain(tr(locale, "shell.debugTitle"));
      // 2) connexion démo → la navigation, le mobile header, la carte d'aide
      await shell.cliquer(tr(locale, "shell.gateLogin", { email: "alex@kredit.be" }));
      const text = shell.text();
      for (const key of NAV_CLIENT) expect(text).toContain(tr(locale, key));
      expect(text).toContain(tr(locale, "shell.customerTitle"));
      expect(text).toContain(tr(locale, "shell.logout"));
      expect(text).toContain(tr(locale, "shell.helpTitle"));
      // la pastille de statut porte la copie en attribut `title` (pas dans textContent)
      const pastille = shell.container.querySelector("[title]") as HTMLElement | null;
      expect(pastille?.getAttribute("title")).toBe(tr(locale, "shell.kycVerified"));
      if (locale !== "fr") {
        // une seule chaîne française qui traînerait dans la nav suffit à rendre l'écran incohérent
        for (const chaine of ["Espace client", "Mes demandes", "Échéanciers", "Déconnexion", "Aperçu maquette", "Paiements", "Réglages"]) {
          expect([locale, chaine, text.includes(chaine)]).toEqual([locale, chaine, false]);
        }
      }
    } finally {
      await shell.disposer();
    }
  });

  it("le premier rendu (HTML serveur) ne porte aucune copie — skeleton identique pour toutes les locales", () => {
    const fr = renderToString(<CustomerShell locale="fr"><b>x</b></CustomerShell>);
    const nl = renderToString(<CustomerShell locale="nl"><b>x</b></CustomerShell>);
    expect(fr).toContain("animate-pulse");
    expect(fr).toBe(nl); // la bascule localisée est post-montage: rien à hydrater, donc rien à faire diverger
    for (const chaine of ["Espace client", "Klantengedeelte"]) expect(fr).not.toContain(chaine);
  });
});

describe("AdminShell — mêmes règles côté back-office", () => {
  it.each([...locales])("/%s — nav, bandeau MFA, alertes", async (locale: Locale) => {
    const shell = await monter(<AdminShell locale={locale} role="ADMIN"><span>contenu</span></AdminShell>);
    try {
      expect(shell.text()).toContain(tr(locale, "shell.adminGateTitle"));
      expect(shell.text()).toContain(tr(locale, "shell.adminGateDemo"));
      expect(shell.text()).toContain(tr(locale, "shell.note", { path: "/api/v1/auth/login" }));
      await shell.cliquer(tr(locale, "shell.adminLogin", { role: "ADMIN" }));
      const text = shell.text();
      for (const key of ["nav.clients", "nav.loans", "nav.audit", "nav.applications", "nav.settings"]) {
        expect(text).toContain(tr(locale, key));
      }
      expect(text).toContain(tr(locale, "shell.mfaEnabled"));
      expect(text).toContain(tr(locale, "shell.modeOperational"));
      expect(text).toContain(tr(locale, "shell.alertsBody"));
      // pluriel ICU résolu par la locale du segment, pas par celle du runtime
      expect(text).toMatch(/3 (alertes|alerts|meldingen|Warnungen)/);
      if (locale !== "fr") expect(text).not.toMatch(/Espace client|Déconnexion|Prêts|Paiements|Échéanciers/);
    } finally {
      await shell.disposer();
    }
  });

  it("écran « accès insuffisant » : la phrase vient du dictionnaire, plus de <strong> en dur", async () => {
    const shell = await monter(<AdminShell locale="nl" role="SUPER_ADMIN"><span>x</span></AdminShell>);
    try {
      await shell.cliquer(tr("nl", "shell.adminLogin", { role: "ADMIN" }));
      expect(shell.text()).toContain(tr("nl", "shell.accessTitle"));
      expect(shell.text()).toContain("U bent aangemeld als ADMIN, maar deze pagina vereist SUPER_ADMIN.");
      expect(shell.text()).toContain(tr("nl", "shell.goDashboard", { role: "ADMIN" }));
    } finally {
      await shell.disposer();
    }
  });
});

describe("vocabulaire de coquille", () => {
  it("toutes les clés nav.*/shell.* existent dans les quatre langues", () => {
    const brutes = readFileSync(join(__dirname, "..", "..", "i18n", "fr", "common.json"), "utf8");
    const keys = [...new Set(brutes.split("\n").map((l) => /^\s*"((?:nav|shell)\.[^"]+)":/.exec(l)?.[1]).filter(Boolean) as string[])];
    expect(keys.length).toBeGreaterThan(25);
    for (const key of keys) {
      const values = locales.map((l) => t(l, `common:${key}`));
      for (const v of values) expect(v && v !== key).toBe(true);
      // une valeur identique au français n'est admise que sans accent (KYC, Documents, Admin…)
      if (/[éèêàâçîïôûùœ]/i.test(values[0])) expect(new Set(values).size).toBe(4);
    }
  });

  it("les deux coquilles ne décrivent plus aucun libellé en dur", () => {
    for (const f of ["components/customer/CustomerShell.tsx", "components/admin/AdminShell.tsx"]) {
      const src = readFileSync(join(__dirname, "..", "..", f), "utf8");
      expect([...src.matchAll(/label:\s*["']/g)]).toEqual([]);
      expect([...src.matchAll(/(label|title):\s*["'][A-ZÀ-Ÿ][^"']{3,}/g)]).toEqual([]);
    }
  });
});
