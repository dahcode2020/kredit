/**
 * a11y — invariants **vérifiés sur le dépôt**, pas sur des objets littéraux.
 *
 * Ce fichier était un test qui ne pouvait pas échouer : il déclarait lui-même l'objet à tester
 * (`const skipLink = { href: "#main-content", … }` puis `expect(skipLink.href).toBe("#main-content")`),
 * ce qui masque exactement les défauts qu'il prétend surveiller. Le premier contrôle honnête l'a montré :
 * l'ancre réelle du layout est `#main` (donc `#main-content` n'aurait jamais été activé par le
 * Tab d'un lecteur d'écran) et le libellé du skip-link était en français sur les quatre marchés.
 *
 * axe-core complet se lance en Playwright (E2E) ; ici on tient les invariants statiques, sans dépendance.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { locales } from "@/lib/i18n";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const dict = (loc: string) => JSON.parse(src(`i18n/${loc}/common.json`)) as Record<string, string>;

/** Contraste WCAG 2.1 (ratio), pour ne plus écrire « ~18:1 » dans une assertion. */
function luminance(hex: string) {
  const c = hex.replace("#", "").match(/../g)!.map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

describe("accessibility invariants (statiques)", () => {
  it("<html lang> est appliqué par la locale du segment, jamais par une valeur du layout racine", () => {
    const root = src("app/layout.tsx");
    const localeLayout = src("app/[locale]/layout.tsx");
    // Le layout racine ne reçoit pas `params` en Next 14 : il ne peut pas connaître la langue.
    expect(root).toContain('<html lang="fr" suppressHydrationWarning>');
    // La correction vient du layout enfant : un script au parsing (premier paint) + HtmlLang (navigation).
    expect(localeLayout).toContain("<HtmlLangScript locale={locale} />");
    expect(localeLayout).toContain("<HtmlLang locale={locale} />");
    const script = src("components/layout/HtmlLang.tsx");
    expect(script).toContain("documentElement.lang");
    expect(script).toContain("el.lang = locale");
  });

  it("les quatre marchés sont prerenderendés, donc lang/HTML ne dépendent pas du navigateur", () => {
    const layout = src("app/[locale]/layout.tsx");
    expect(layout).toMatch(/generateStaticParams[\s\S]*locales\.map\(\(locale\) => \(\{ locale \}\)\)/);
    expect(locales).toEqual(["fr", "en", "nl", "de"]);
  });

  it("landmarks attendus présents dans le DOM rendu", () => {
    const layout = src("app/[locale]/layout.tsx");
    const header = src("components/layout/Header.tsx");
    const footer = src("components/layout/Footer.tsx");
    expect(header).toContain("<header");
    expect(header).toContain("<nav");
    expect(footer).toContain("<footer");
    expect(layout).toContain("<main id=\"main\"");
  });

  it("skip-link : premier nœud focusable, cible réelle, libellé traduit", () => {
    const layout = src("app/[locale]/layout.tsx");
    const lien = /<a href="#main"[\s\S]*?<\/a>/.exec(layout);
    expect(lien).not.toBeNull();
    // Le lien doit précéder l'en-tête : c'est le premier élément focusable du document.
    expect(layout.indexOf('<a href="#main"')).toBeLessThan(layout.indexOf("<Header"));
    // Classe sr-only + focus visible (sinon le lien est injectable mais inutilisable au clavier).
    expect(lien![0]).toContain("sr-only");
    expect(lien![0]).toContain("focus:not-sr-only");
    // La cible doit exister telle quelle (l'ancien test écrivait `#main-content`).
    expect(layout).toContain('<main id="main"');
    // Et le libellé vient du dictionnaire, pas d'une chaîne en dur du layout racine.
    expect(lien![0]).toContain('t(locale, "common:shell.skipToContent")');
    // Un seul skip-link dans l'arbre rendu: le layout racine en rendait un second, en dur, donc français
    // sur /en /nl /de — et « aller au contenu » n'a aucun accent, ce qui le rend invisible au budget de
    // copie (d'où cette assertion plutôt que le compteur).
    expect(src("app/layout.tsx")).not.toContain('href="#main"');
    const nb = ["app/[locale]/layout.tsx", "components/layout/Header.tsx", "components/layout/Footer.tsx"]
      .reduce((n, f) => n + (src(f).match(/href="#main"/g) ?? []).length, 0);
    expect(nb).toBe(1);
    for (const l of locales) expect(dict(l)["shell.skipToContent"]).toBeTruthy();
    expect(dict("fr")["shell.skipToContent"]).toBe("Aller au contenu");
    expect(dict("nl")["shell.skipToContent"]).toBe("Naar hoofdinhoud");
    expect(dict("de")["shell.skipToContent"]).toBe("Zum Inhalt springen");
  });

  it("aria-live : le chrome PWA annonce l'état, sans voler le focus", () => {
    const banner = src("components/pwa/OfflineNotice.tsx");
    const status = src("components/pwa/ConnectivityStatus.tsx");
    expect(banner).toContain('role="alert"');            // perte de connexion : annoncé
    expect(banner).toContain('aria-live="polite"');       // reprise : pas de vol de focus
    expect(status).toContain('role="status"');
    expect(status).toContain('aria-live="polite"');
    // Le texte annoncé sort du dictionnaire (il était en dur → announcement français sur un lecteur nl).
    expect(banner).toContain('t("pwa.offlineBanner")');
    expect(banner).not.toMatch(/>\s*"?(Hors ligne|Reconnexion)[^"]*"/);
  });

  it("contraste du texte courant (palette lue dans tailwind.config.js, pas recopiée dans le test)", () => {
    const tw = src("tailwind.config.js");
    const couleur = (nom: string) => {
      const m = new RegExp(`${nom}:\\s*\\{\\s*DEFAULT:\\s*"(#[0-9a-fA-F]{6})"`, "i").exec(tw);
      if (!m) throw new Error(`couleur « ${nom} » introuvable dans tailwind.config.js — le test ne doit pas la deviner`);
      return m[1];
    };
    const paper = "#FFFFFF"; // surface du corps: bg-white (app/layout.tsx)
    expect(ratio(couleur("ink"), paper)).toBeGreaterThanOrEqual(4.5);
    // `primary` sert d'accent, de gros titres et d'icônes sur fond clair : jamais de corps de texte.
    // En 3:1 (texte ≥ 24px ou non-textuel, WCAG 1.4.11) il passe ; écrire dans le test « AA = OK »
    // sans dire à quelle borne serait le genre d'affirmation que personne n'ose plus vérifier.
    expect(ratio(couleur("primary"), paper)).toBeGreaterThanOrEqual(3);
    // `surface` doit rester distinguable de blanc (bordures des cartes) sans écraser le texte.
    expect(ratio(couleur("ink"), "#F8F9FA")).toBeGreaterThanOrEqual(4.5);
  });

  it("`prefers-reduced-motion` neutralise l'animation des pastilles", () => {
    const globals = src("app/globals.css");
    expect(globals).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });
});
