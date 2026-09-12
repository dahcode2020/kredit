/**
 * Copie des composants PWA — verrou de la passe 9.
 *
 * `components/pwa/*` est rendu par le layout de **toutes** les pages du site, y compris les routes
 * `live-SDK` et la page de repli servie par le service worker. Sa copie était écrite en dur en
 * français : un investisseur `nl` en mode hors ligne recevait un bandeau d'avertissement dans une
 * langue qu'il ne parle pas — au moment précis où il est le moins joignable.
 *
 * Ce qui est réellement contrôlé :
 *  - chaque composant rend la valeur du dictionnaire de SA locale (et pas le français) ;
 *  - `RetryButton` / `ServerRequiredNotice` n'ont plus de défaut de prop en dur : ils retombent sur
 *    la clé i18n quand l'appelant omet la prop (le cas réel de `/[locale]/offline`) ;
 *  - la page `/[locale]/offline`, rendue côté serveur, est traduite dans le HTML même — et ne contient
 *    plus son dictionnaire maison `{fr,en,nl,de}` (deux sources de vérité = une traduction oubliée) ;
 *  - `lib/pwa.ts` n'arrose plus l'interface : `description` est une documentation développeur, donc une
 *    chaîne française dans un composant (et `CACHE_STRATEGIES` est importé par du code **edge** : une
 *    dépendance i18n là-dedans gonflerait le bundle du middleware).
 *
 * Les composants sont montés en jsdom (le test des coquilles a montré que `renderToString` seul ne
 * suffit pas pour un composant qui passe par `useSyncExternalStore`).
 */
import { renderToString } from "react-dom/server";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "fs";
import { join } from "path";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/** Locale simulée du segment `[locale]` — même source que le composant réel, cf. hooks/useLocale.ts. */
let localeCourant = "fr";
jest.mock("next/navigation", () => ({
  usePathname: () => `/${localeCourant}/offline`,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocale: () => localeCourant,
  useParams: () => ({ locale: localeCourant }),
  useSearchParams: () => new URLSearchParams(),
}));
let horsLigne = false;
jest.mock("@/hooks/useConnectivity", () => ({
  useConnectivity: () => ({
    state: horsLigne ? "OFFLINE" : "ONLINE",
    isOffline: horsLigne,
    isOnline: !horsLigne,
    isSyncing: false,
    lastOnline: new Date("2026-09-11T10:00:00+02:00"),
    onReconnect: () => jest.fn(),
  }),
}));
jest.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({
    permission: "default",
    support: "supported" as const,
    subscribed: false,
    loading: false,
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  }),
}));

import ConnectivityStatus, { ConnectivityDot } from "@/components/pwa/ConnectivityStatus";
import { OfflineBanner, ServerRequiredNotice } from "@/components/pwa/OfflineNotice";
import { RetryButton } from "@/components/pwa/OfflineActions";
import PushManager from "@/components/pwa/PushManager";
import OfflinePage from "@/app/[locale]/offline/page";

const LANGE = ["fr", "en", "nl", "de"] as const;
type Lang = (typeof LANGE)[number];
const dicts: Record<Lang, Record<string, string>> = Object.fromEntries(
  LANGE.map((l) => [l, JSON.parse(readFileSync(join(process.cwd(), `i18n/${l}/common.json`), "utf8"))])
) as any;
const lib = (l: Lang, cle: string) => dicts[l][cle];

function traduits(cles: string[]) {
  it("les quatre dictionnaires portent la clé, avec une valeur distincte du français", () => {
    for (const cle of cles) {
      for (const l of LANGE) expect(lib(l, cle)).toBeTruthy();
      const fr = lib("fr", cle);
      if (/[éèêàâçîïôûùœ]/i.test(fr)) {
        for (const l of LANGE.filter((x) => x !== "fr")) {
          if (lib(l, cle) === fr && !/^Currency|^[A-Z][a-z]+$/.test(fr)) fail(`${l} → ${cle} identique au français`);
        }
      }
    }
  });
}

/** Montage client réel dans un conteneur neuf (mêmes précautions que le test des coquilles). */
async function monter(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | undefined;
  await act(async () => {
    const r = createRoot(container);
    root = r;
    r.render(element);
  });
  const sortie = {
    container,
    texte: () => container.textContent ?? "",
    async disposer() {
      await act(async () => root?.unmount());
      container.remove();
    },
  };
  montages.push(sortie);
  return sortie;
}
const montages: { disposer(): Promise<void> }[] = [];
afterEach(async () => {
  while (montages.length) await montages.pop()!.disposer();
});

describe("pastille de connexion (ConnectivityStatus)", () => {
  LANGE.forEach((l) => {
    it(`rend l'état en ${l} (montage hydraté)`, async () => {
      localeCourant = l;
      const { container, texte } = await monter(<ConnectivityStatus />);
      expect(texte()).toContain(lib(l, "pwa.online"));
      expect(texte()).toContain(lib(l, "pwa.onlineSub"));
      if (l !== "fr") expect(texte()).not.toContain("En ligne");
      expect(container.querySelector("[aria-label]")?.getAttribute("aria-label")).toBe(
        lib(l, "pwa.stateAria").replace("{state}", lib(l, "pwa.online"))
      );
    });
  });

  it("la pastille du header a une infobulle traduite", async () => {
    localeCourant = "nl";
    const { container } = await monter(<ConnectivityDot />);
    expect(container.querySelector("span[title]")?.getAttribute("title")).toBe(lib("nl", "pwa.onlineDot"));
  });
});

describe("bandeau hors ligne + notifications push", () => {
  it("OfflineBanner et PushManager suivent la locale", async () => {
    for (const l of LANGE) {
      localeCourant = l;
      await monter(<OfflineBanner />);
      const { texte: textePush } = await monter(<PushManager />);
      expect(textePush()).toContain(lib(l, "pwa.pushTitle"));
      expect(textePush()).toContain(lib(l, "pwa.pushBody"));
      if (l !== "fr") expect(textePush()).not.toContain("Notifications push");
    }
  });
});

describe("défauts de props (la classe de bug que le budget de copie ne voyait pas)", () => {
  it("RetryButton sans prop explicite rend l'étiquette du dictionnaire", async () => {
    for (const l of LANGE) {
      localeCourant = l;
      const { texte } = await monter(<RetryButton />);
      expect(texte()).toContain(lib(l, "pwa.retry"));
      if (l !== "fr") expect(texte()).not.toContain("Réessayer");
    }
  });

  it("ServerRequiredNotice sans actionLabel retombe sur la clé i18n, pas sur « Opération »", async () => {
    for (const l of LANGE) {
      localeCourant = l;
      horsLigne = true; // le bandeau n'existe qu'hors ligne
      const { texte } = await monter(<ServerRequiredNotice />);
      horsLigne = false;
      expect(texte()).toContain(lib(l, "pwa.operation"));
      expect(texte()).toContain(lib(l, "pwa.serverRequiredFinancial"));
      // La description French-only de lib/pwa.ts ne doit plus arroser l'interface.
      expect(texte()).not.toContain("Jamais mis en cache");
      expect(texte()).toContain(lib(l, "pwa.strategyLabel"));
    }
  });
});

describe("page /[locale]/offline", () => {
  traduits([
    "pwa.offlinePageTitle", "pwa.offlinePageSub", "pwa.offlineAvailable", "pwa.offlineRequires",
    "pwa.offlineSimulator", "pwa.offlineHome", "pwa.offlineHelpTitle", "pwa.offlineContact", "pwa.retry",
  ]);

  LANGE.forEach((l) => {
    it(`le HTML rendu côté serveur est en ${l}`, () => {
      localeCourant = l; // les client components enfants lisent le même segment [locale] au premier rendu
      const html = renderToString(<OfflinePage params={{ locale: l }} />);
      const texte = html
        .replace(/<[^>]*>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#x27;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ");
      expect(texte).toContain(lib(l, "pwa.offlinePageTitle"));
      expect(texte).toContain(lib(l, "pwa.offlineAvail1"));
      expect(texte).toContain(lib(l, "pwa.offlineUnavail1"));
      expect(texte).toContain(lib(l, "pwa.retry"));
      if (l !== "fr") {
        expect(texte).not.toContain("Vous êtes hors ligne");
        expect(texte).not.toContain("Réessayer");
      }
    });
  });

  it("aucune copie française en dur dans les sources", () => {
    const fichiers = [
      "app/[locale]/offline/page.tsx",
      "components/pwa/OfflineNotice.tsx",
      "components/pwa/ConnectivityStatus.tsx",
      "components/pwa/InstallPrompt.tsx",
      "components/pwa/UpdatePrompt.tsx",
      "components/pwa/PushManager.tsx",
      "components/pwa/OfflineActions.tsx",
    ];
    for (const f of fichiers) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      // Hors commentaires : la documentation du projet est en français, et n'est jamais rendue.
      const corps = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const francais = [...corps.matchAll(/>([^<>{}\n]{3,})</g)]
        .map((m) => m[1].replace(/&[a-z]+;/gi, " ").trim())
        .filter((s) => s.split(/\s+/).length >= 2 && /[éèêàâçîïôûùœ]/i.test(s));
      expect({ fichier: f, francais }).toEqual({ fichier: f, francais: [] });
    }
  });
});
