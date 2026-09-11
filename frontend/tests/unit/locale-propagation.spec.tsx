/**
 * Propagation de la locale — verrous de la passe 5.
 *
 * Famille corrigée : des pages écrivaient `formatEUR2(v, "fr-BE")` (et `locale: "fr_BE"`,
 * `canonical: "/fr"` dans le layout racine). Un tag de locale choisi par un composant, c'est
 * (a) un utilisateur `nl`/`de` formaté à la française sans erreur, (b) une métadonnée identique
 * pour quatre langues, (c) une divergence dès qu'un appelant, lui, dérive la locale du segment.
 * Trois verrous : une seule table de tags, des métadonnées par segment, et un rendu réel.
 */
// `act` de react-dom/test-utils n'accepte les mises à jour que si l'environnement est marqué.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { renderToString } from "react-dom/server";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt?: string }) => <img src={typeof src === "string" ? src : ""} alt={alt ?? ""} />,
}));

import { localeToIntl as localeToIntlFromI18n, openGraphLocale, locales } from "@/lib/i18n";
import { formatCurrency, localeToIntl as localeToIntlFromFormatters } from "@/lib/formatters";
import { formatEUR2 } from "@/lib/utils";

describe("tables de locale — une seule source", () => {
  it("lib/formatters ré-exporte la table de lib/i18n (pas une copie)", () => {
    expect(localeToIntlFromFormatters).toBe(localeToIntlFromI18n);
  });

  it("toutes les locales applicatives ont un tag Intl et un tag Open Graph", () => {
    for (const locale of locales) {
      expect(localeToIntlFromI18n[locale]).toMatch(/^[a-z]{2}-BE$/);
      expect(openGraphLocale[locale]).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    }
  });

  it("jamais le tag refusé par le parseur Open Graph", () => {
    // `fr_BE` (l'ancienne valeur du layout racine) n'est pas dans l'énumération og:locale.
    expect(Object.values(openGraphLocale)).not.toContain("fr_BE");
    expect(openGraphLocale.fr).toBe("fr_FR");
  });

  it("formatEUR2 applique la locale demandée, sans défaut silencieux", () => {
    expect(formatEUR2.length).toBe(2); // `(amount, locale)` : plus aucun paramètre optionnel
    const out = locales.map((l) => formatEUR2(1234.56, l));
    expect(new Set(out).size).toBe(4);
    locales.forEach((l, i) => expect(out[i]).toBe(formatCurrency(1234.56, l)));
  });
});

describe("métadonnées — dérivées du segment [locale]", () => {
  // Le layout racine ne reçoit pas `params`: tout ce qui dépend de la langue doit être produit
  // par `app/[locale]/layout.tsx`.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const layout = require("@/app/[locale]/layout");

  it.each(["fr", "en", "nl", "de"])("/%s — canonical, hreflang et og:locale suivent la locale", async (locale) => {
    const md = await layout.generateMetadata({ params: { locale } });
    expect(md.alternates.canonical).toBe(`/${locale}`);
    expect(md.alternates.languages[locale]).toBe(`/${locale}`);
    expect(md.alternates.languages["x-default"]).toBe("/fr");
    expect(md.openGraph.url).toBe(`https://kredit.be/${locale}`);
    expect(md.openGraph.locale).toBe(openGraphLocale[locale as keyof typeof openGraphLocale]);
    expect(md.openGraph.alternateLocales).toHaveLength(locales.length - 1);
    expect(md.openGraph.alternateLocales).not.toContain(openGraphLocale[locale as keyof typeof openGraphLocale]);
    expect(Object.keys(md.alternates.languages).sort()).toEqual([...locales, "x-default"].sort());
    // Piège mesuré pendant la correction: Next **remplace** `openGraph` au lieu de le fusionner,
    // donc un bloc enfant partiel faisait silencieusement disparaître og:image / og:site_name / og:type.
    expect(md.openGraph.images).toHaveLength(1);
    expect(md.openGraph.images[0].url).toContain("icon-512.png");
    expect(md.openGraph.siteName).toBe("KREDIT");
    expect(md.openGraph.type).toBe("website");
  });

  it("le layout racine ne redéclare rien qui dépende de la langue", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const root = require("@/app/layout");
    expect(root.metadata.openGraph).toBeUndefined();   // sinon: bloc enfant partiel = image perdue
    expect(root.metadata.alternates).toBeUndefined(); // sinon: canonical unique pour 4 langues
  });

  it("une locale inconnue retombe sur la locale par défaut, pas sur « fr-BE »", async () => {
    const md = await layout.generateMetadata({ params: { locale: "xx" } });
    expect(md.alternates.canonical).toBe("/fr");
    expect(md.openGraph.locale).toBe(openGraphLocale.fr);
  });
});

describe("pages client — le montant suit la langue de l'URL", () => {
  // Ces pages sont rendues côté client (le shell attend l'hydratation du store d'auth) : le
  // contrôle se fait donc sur un vrai montage, pas sur le HTML serveur.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PaymentsPage = require("@/app/[locale]/payments/page").default;

  async function mountWithLocale(locale: string) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root: Root | undefined;
    try {
      // deux rendus: le premier tombe sur le skeleton (le store `persist` n'a pas encore relancé
      // le composant), le second rend la page une fois `hasHydrated` devenu vrai.
      await act(async () => { const r = createRoot(container); root = r; r.render(<PaymentsPage params={{ locale }} />); });
      await act(async () => { root?.render(<PaymentsPage params={{ locale }} />); });
      return container.textContent ?? "";
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  }

  it("monte la page Paiements et rend le montant dans la langue du segment", async () => {
    const fr = await mountWithLocale("fr");
    const nl = await mountWithLocale("nl");
    const amount = 463.12;
    expect(fr).toContain(formatEUR2(amount, "fr"));
    expect(nl).toContain(formatEUR2(amount, "nl"));
    // le verrou du bug : avant la correction, les deux pages affichaient la même chaîne francaise
    expect(fr).not.toContain(formatEUR2(amount, "nl"));
    expect(nl).not.toContain(formatEUR2(amount, "fr"));
  });

  it("le HTML serveur (skeleton) ne contient aucun montant — la bascule est bien post-hydratation", () => {
    const html = renderToString(<PaymentsPage params={{ locale: "fr" }} />);
    expect(html).toContain("animate-pulse");
    expect(html).not.toContain("463");
  });
});
