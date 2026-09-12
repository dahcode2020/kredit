/**
 * Verrou: le service worker ne doit pas vivre en développement.
 *
 * Un worker actif sur `next dev` met en cache `/_next/static/chunks/webpack.js` (URL stable,
 * réécrite à chaque compile). L'exemplaire périmé resservi face aux chunks neufs produit
 * « TypeError: Cannot read properties of undefined (reading 'call') ». `SWRegister` est monté
 * dans le layout racine, donc sur toutes les pages: la garde doit être testée dans les deux sens.
 */
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import SWRegister from "@/components/pwa/SWRegister";

/** Montage client réel (même précaution que les autres specs PWA: pas de @testing-library ici). */
async function monter() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | undefined;
  await act(async () => {
    root = createRoot(container);
    root.render(<SWRegister />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return async () => {
    await act(async () => root?.unmount());
    container.remove();
  };
}

const env = process.env as unknown as Record<string, string | undefined>;

/** Fakes installés une seule fois: jsdom refuse qu'on redéfinisse ou supprime `navigator.serviceWorker`. */
type Etat = { register: number; unregister: number; cachesSupprimes: string[]; uneRegistration: boolean };
const etat: Etat = { register: 0, unregister: 0, cachesSupprimes: [], uneRegistration: false };
let swOriginal: ServiceWorkerContainer | undefined;
const reg = {
  unregister: async () => {
    etat.unregister++;
    return true;
  },
  addEventListener: () => {},
  installing: null,
  update: async () => {},
};

beforeAll(() => {
  // tests/setup.ts a déjà posé un faux `navigator.serviceWorker` en writable (non configurable):
  // on lui substitue un objet espion par affectation, et on le rend à la fin du fichier.
  swOriginal = navigator.serviceWorker;
  Object.defineProperty(navigator, "serviceWorker", {
    writable: true,
    configurable: true,
    value: {
      ready: Promise.resolve(reg),
      get controller() {
        return etat.uneRegistration ? reg : null;
      },
      register: async () => {
        etat.register++;
        return reg;
      },
      getRegistrations: async () => (etat.uneRegistration ? [reg] : []),
    },
  });
  if (!("caches" in window)) {
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        keys: async () => ["kredit-static-kredit-v6", "kredit-public-kredit-v6", "autre-cache"],
        delete: async (nom: string) => {
          etat.cachesSupprimes.push(nom);
          return true;
        },
      },
    });
  }
});

afterAll(() => {
  Object.defineProperty(navigator, "serviceWorker", { writable: true, configurable: true, value: swOriginal });
});

beforeEach(() => {
  etat.register = 0;
  etat.unregister = 0;
  etat.cachesSupprimes = [];
});

const laisserTourner = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe("SWRegister — environnement", () => {
  let deMontage: (() => Promise<void>) | null = null;
  const nodeEnv = env.NODE_ENV;
  afterEach(async () => {
    await deMontage?.();
    deMontage = null;
    env.NODE_ENV = nodeEnv;
  });

  it("en dev: aucun enregistrement, les registrations existantes sont nettoyées", async () => {
    env.NODE_ENV = "development";
    etat.uneRegistration = true;
    deMontage = await monter();
    await laisserTourner();
    expect(etat.register).toBe(0);
    expect(etat.unregister).toBe(1);
    expect(etat.cachesSupprimes.sort()).toEqual([
      "kredit-public-kredit-v6",
      "kredit-static-kredit-v6",
    ]);
  });

  it("en dev: sans registration, rien n'est enregistré mais les caches sont quand même purgés", async () => {
    // Une registration peut avoir disparu en laissant ses caches (onglet fermé pendant un
    // activate): la purge est inconditionnelle, sinon le chunk périmé survivrait au correctif.
    env.NODE_ENV = "development";
    etat.uneRegistration = false;
    deMontage = await monter();
    await laisserTourner();
    expect(etat.register).toBe(0);
    expect(etat.unregister).toBe(0);
    expect(etat.cachesSupprimes.sort()).toEqual([
      "kredit-public-kredit-v6",
      "kredit-static-kredit-v6",
    ]);
  });

  it("en production: le worker est bien enregistré", async () => {
    env.NODE_ENV = "production";
    etat.uneRegistration = false;
    deMontage = await monter();
    if (document.readyState !== "complete") {
      await act(async () => {
        window.dispatchEvent(new Event("load"));
      });
    }
    await laisserTourner();
    expect(etat.register).toBe(1);
    expect(etat.unregister).toBe(0);
    expect(etat.cachesSupprimes).toEqual([]);
  });
});
