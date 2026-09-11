/**
 * Copie et manifeste par locale — passe 6.
 *
 * Le layout racine et `public/manifest.json` sont **hors de l'arbre React** : ils ne voient pas le
 * segment `[locale]`, donc ils servaient pendant longtemps une copie française et des URL `/fr` aux
 * trois autres langues (`<title>`, meta description, `og:title`, `start_url`, tuiles de la PWA).
 * Trois verrous : les dictionnaires restent en parité, aucune valeur n'est « oubliée en français »,
 * et le manifeste généré suit la locale demandée.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { locales, t } from "@/lib/i18n";
import { buildManifest, pwaShortcuts } from "@/lib/pwa-manifest";

const I18N_DIR = join(__dirname, "..", "..", "i18n");
const LANGS = ["fr", "en", "nl", "de"] as const;
type Lang = (typeof LANGS)[number];

/**
 * `ns:key` → valeur, pour une langue. `OVERRIDE` (namespace `fr-BE`) n'existe que pour `fr` :
 * il surcharge des clés du français, il n'a donc rien à parité avec les autres langues.
 */
const OVERRIDE = "fr-BE";
function dict(lang: Lang, avecOverride = false) {
  const out: Record<string, string> = {};
  for (const file of readdirSync(join(I18N_DIR, lang)).sort()) {
    if (!file.endsWith(".json")) continue;
    const ns = file.replace(/\.json$/, "");
    if (!avecOverride && ns === OVERRIDE) continue;
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(join(I18N_DIR, lang, file), "utf8")))) {
      out[`${ns}:${k}`] = String(v);
    }
  }
  return out;
}
const DICTS = Object.fromEntries(LANGS.map((l) => [l, dict(l)])) as Record<Lang, Record<string, string>>;
const dictAvecOverride = (lang: Lang) => dict(lang, true);
const PLACEHOLDERS = /\{(\w+)(?:,\s*(plural|select|number|date))?/g;
const ACCENTS = /[éèêëàâäçîïôöûùüœ]/i;
/** Seule valeur qui DOIT rester identique dans les quatre langues : l'endonyme de la langue. */
const ENONYM_KEYS = new Set(["common:language.fr"]);

describe("dictionnaires — parité des quatre langues", () => {
  it("les mêmes clés partout (hors override fr-BE)", () => {
    const ref = DICTS.fr;
    expect(Object.keys(ref).length).toBeGreaterThan(150);
    // l'override ne doit exister QUE pour fr: ailleurs il ne surcharge rien et endort la lecture
    for (const lang of LANGS) {
      const n = Object.keys(dictAvecOverride(lang)).filter((k) => k.startsWith(`${OVERRIDE}:`)).length;
      expect(n).toBe(lang === "fr" ? Object.keys(JSON.parse(readFileSync(join(I18N_DIR, "fr", "fr-BE.json"), "utf8"))).length : 0);
    }
    for (const lang of LANGS) {
      const missing = Object.keys(ref).filter((k) => !(k in DICTS[lang]));
      const extra = Object.keys(DICTS[lang]).filter((k) => !(k in ref));
      expect({ lang, missing, extra }).toEqual({ lang, missing: [], extra: [] });
    }
  });

  it("aucune valeur vide", () => {
    for (const lang of LANGS) {
      expect(Object.entries(DICTS[lang]).filter(([, v]) => !v.trim())).toEqual([]);
    }
  });

  it("mêmes variables ICU et mêmes blocs plural/select partout", () => {
    const vars = (s: string) => [...s.matchAll(PLACEHOLDERS)].map((m) => `${m[1]}${m[2] ? `:${m[2]}` : ""}`).sort();
    for (const key of Object.keys(DICTS.fr)) {
      const expected = vars(DICTS.fr[key]);
      for (const lang of LANGS) expect([key, lang, vars(DICTS[lang][key] ?? "")]).toEqual([key, lang, expected]);
    }
  });

  it("aucune chaîne laissée en français (le seul cas légitime est l'endonyme)", () => {
    const offenders: string[] = [];
    for (const key of Object.keys(DICTS.fr)) {
      if (!ACCENTS.test(DICTS.fr[key])) continue; // sans accent, indistinguable d'un loanword
      for (const lang of LANGS) {
        if (lang === "fr" || ENONYM_KEYS.has(key)) continue;
        if (DICTS[lang][key] === DICTS.fr[key]) offenders.push(`${lang} → ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("la copie du site (seo.*) est bien différente dans les quatre langues", () => {
    for (const key of ["common:seo.title", "common:seo.description"]) {
      const values = locales.map((l) => t(l, key));
      expect(new Set(values).size).toBe(4);
      for (const v of values) expect(v).not.toMatch(/^\s*$/);
    }
    expect(t("fr", "common:seo.title")).toContain("KREDIT");
    expect(t("nl", "common:seo.title")).toContain("België");
    expect(t("de", "common:seo.title")).toContain("Belgien");
  });

  it("une clé absente d'une langue retombe sur le français — d'où la parité ci-dessus", () => {
    // `t` ne lève pas: il avertit (en navigateur) et rend la clé. Ce mode silencieux est exactement
    // ce que la parité rend impossible — le test verrouille les deux moitiés du comportement.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(t("nl", "common:no.existe.pas")).toBe("common:no.existe.pas");
      expect(warn.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(/missing key "common:no.existe.pas"/);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("manifeste PWA — par locale", () => {
  it("public/manifest.json ne préfixe plus aucune URL par une langue", () => {
    const raw = readFileSync(join(__dirname, "..", "..", "public", "manifest.json"), "utf8");
    expect([...raw.matchAll(/["']\/(fr|en|nl|de)(?=[/?#"'])/g)]).toEqual([]);
  });

  it.each(LANGS)("/manifest/%s.json — identifiants, URL et copie suivent la locale", (lang) => {
    const m = buildManifest(lang);
    expect(m.lang).toBe(lang);
    expect(m.id).toBe(`/${lang}`);
    expect(m.start_url).toBe(`/${lang}?utm_source=homescreen`);
    expect(m.scope).toBe("/");
    expect(m.name).toBe(t(lang, "common:seo.title"));
    expect(m.description).toBe(t(lang, "common:seo.description"));
    // tuiles : libellés pris dans le dictionnaire, URL préfixées par la locale
    expect(m.shortcuts.map((sh) => sh.name)).toEqual([
      t(lang, "common:nav.simulator"), t(lang, "common:nav.dashboard"), t(lang, "common:nav.invest"),
    ]);
    expect(m.shortcuts.map((sh) => sh.url)).toEqual([`/${lang}#simulateur`, `/${lang}/dashboard`, `/${lang}/investments`]);
    expect(m.protocol_handlers[0].url).toBe(`/${lang}?url=%s`);
    expect(m.share_target.action).toBe(`/${lang}?share-target`);
    // les champs non traduits (icônes, captures, couleurs, display) restent ceux du fichier de base
    const base = JSON.parse(readFileSync(join(__dirname, "..", "..", "public", "manifest.json"), "utf8"));
    for (const key of Object.keys(base)) expect(m).toHaveProperty(key);
    expect(m.icons).toEqual(base.icons);
  });

  it("les trois autres langues ne reçoivent jamais la version française", () => {
    const fr = buildManifest("fr");
    for (const lang of ["en", "nl", "de"] as const) {
      const m = buildManifest(lang);
      expect(m.name).not.toBe(fr.name);
      expect(m.description).not.toBe(fr.description);
      expect(m.start_url).not.toBe(fr.start_url);
      expect(m.shortcuts.map((s) => s.url)).not.toEqual(fr.shortcuts.map((s) => s.url));
    }
  });

  it("les tuiles ne pointent que sur des routes connues du site", () => {
    const connues = ["#simulateur", "/dashboard", "/investments"];
    for (const lang of LANGS) {
      for (const sh of pwaShortcuts(lang)) {
        expect(sh.url.startsWith(`/${lang}`)).toBe(true);
        expect(connues).toContain(sh.url.slice(1 + lang.length));
      }
    }
  });
});

describe("métadonnées du layout [locale] — copie localisée", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const layout = require("@/app/[locale]/layout");

  it.each(LANGS)("/%s — title, description, twitter et manifest du layout", async (lang) => {
    const md = await layout.generateMetadata({ params: { locale: lang } });
    expect(md.title.absolute).toBe(t(lang, "common:seo.title"));
    expect(md.title.default).toBeUndefined();
    expect(md.description).toBe(t(lang, "common:seo.description"));
    expect(md.manifest).toBe(`/manifest/${lang}`);
    expect(md.openGraph.title).toBe(md.title.absolute); // un seul endroit définit la copie
    expect(md.openGraph.description).toBe(md.description);
    expect(md.twitter.title).toBe(md.title.absolute);
    expect(md.twitter.description).toBe(md.description);
  });

  it("la copie traduite est bien differente d'une langue à l'autre dans le <head>", async () => {
    const titres = [] as string[];
    const descriptions = [] as string[];
    for (const lang of LANGS) {
      const md = await layout.generateMetadata({ params: { locale: lang } });
      titres.push(md.title.absolute);
      descriptions.push(md.description);
    }
    expect(new Set(titres).size).toBe(4);
    expect(new Set(descriptions).size).toBe(4);
  });

  it("le middleware laisse passer les routes hors app (manifest, sw, assets)", () => {
    // Le matcher du middleware est une négation: `/manifest/nl` doit en faire partie, sinon la
    // redirection de locale en fait `/nl/manifest/nl` (307) et la PWA ne s'installe plus.
    const src = readFileSync(join(__dirname, "..", "..", "middleware.ts"), "utf8");
    const matcher = /matcher:\s*\["\/\(\(([^)]+)\)\.\*\)"\]/.exec(src);
    expect(matcher).not.toBeNull();
    const exclusions = matcher![1].replace(/^\?!/, "").split("|");
    const ignorée = (p: string) => exclusions.some((e) => p.startsWith(`/${e}`));
    expect(ignorée("/manifest/nl")).toBe(true);
    expect(ignorée("/manifest/fr")).toBe(true);
    expect(ignorée("/manifest.json")).toBe(true);
    expect(ignorée("/sw.js")).toBe(true);
    expect(ignorée("/payments")).toBe(false);
    expect(ignorée("/fr/payments")).toBe(false);
  });

  it("le layout racine ne porte plus de copie liée à une langue", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const root = require("@/app/layout");
    expect(root.metadata.manifest).toBeUndefined();
    expect(root.metadata.description).toBeUndefined();   // servie aux 4 langues: déplacée chez l'enfant
    expect(root.metadata.title.default).toBeUndefined();
    expect(root.metadata.title.absolute).toBeUndefined();
    expect(root.metadata.twitter).toBeUndefined();
    expect(root.metadata.title.template).toBe("%s | KREDIT"); // motif commun, non traduit: OK
  });
});

describe("fallbacks offline — par locale", () => {
  it("la page offline demandée est celle de la locale, avec repli explicite", async () => {
    const { offlineFallbackUrl, OFFLINE_DEFAULT_LOCALE } = await import("@/lib/pwa");
    expect(offlineFallbackUrl("nl")).toBe("/nl/offline");
    expect(offlineFallbackUrl("de")).toBe("/de/offline");
    expect(offlineFallbackUrl(null)).toBe(`/${OFFLINE_DEFAULT_LOCALE}/offline`);
  });

  it("les motifs de stratégie de cache ne pincent aucune langue", async () => {
    const { CACHE_STRATEGIES } = await import("@/lib/pwa");
    const tous = Object.values(CACHE_STRATEGIES).flatMap((s: any) => s.examples as string[]).join(" ");
    expect(tous).not.toMatch(/\/(fr|en|nl|de)[/?*]/);
    expect(tous).toContain("/{locale}/dashboard");
  });
});
