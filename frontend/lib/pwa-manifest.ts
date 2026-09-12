import base from "@/public/manifest.json";
import { Locale, localeDir, t } from "./i18n";

/**
 * Manifeste PWA **par locale**.
 *
 * `public/manifest.json` portait `start_url: "/fr?…"`, les `shortcuts`, `protocol_handlers` et
 * `share_target` pointaient aussi sur `/fr` : un visiteur néerlandais qui installait la PWA depuis
 * `/nl` ouvrait ensuite une application **en français**, avec des tuiles d'applications en français.
 * Le manifeste est hors de l'arbre React (le layout racine ne voit pas les params du segment), donc
 * rien ne le corrigeait « tout seul » : il est désormais construit ici et servi par
 * `/manifest/{locale}.json` (déclaré dans `app/[locale]/layout.tsx`).
 *
 * `public/manifest.json` reste la base (icônes, captures, couleurs) et le repli des installations
 * déjà présentes sur les postes — il ne doit plus contenir d'URL préfixée par une langue.
 */
export type PwaShortcut = { name: string; description: string; url: string; icons: { src: string; sizes: string }[] };

export const pwaShortcuts = (locale: Locale): PwaShortcut[] => {
  const icons = base.shortcuts?.[0]?.icons ?? [{ src: "/icons/icon-192.png", sizes: "192x192" }];
  return [
    {
      name: t(locale, "common:nav.simulator"),
      description: t(locale, "common:seo.shortcut.simulator.description"),
      url: `/${locale}#simulateur`,
      icons,
    },
    {
      name: t(locale, "common:nav.dashboard"),
      description: t(locale, "common:seo.shortcut.dashboard.description"),
      url: `/${locale}/dashboard`,
      icons,
    },
    {
      name: t(locale, "common:nav.invest"),
      description: t(locale, "common:seo.shortcut.invest.description"),
      url: `/${locale}/investments`,
      icons,
    },
  ];
};

export function buildManifest(locale: Locale) {
  return {
    ...base,
    id: `/${locale}`,
    start_url: `/${locale}?utm_source=homescreen`,
    scope: "/", // les quatre langues sont la même application
    lang: locale,
    dir: localeDir[locale],
    name: t(locale, "common:seo.title"),
    short_name: "KREDIT",
    description: t(locale, "common:seo.description"),
    shortcuts: pwaShortcuts(locale),
    protocol_handlers: [{ protocol: "web+kredit", url: `/${locale}?url=%s` }],
    share_target: { ...base.share_target, action: `/${locale}?share-target` },
  };
}
