/**
 * @jest-environment node
 */
/**
 * Installations sous npm ≥ 12 — ou le blocage des scripts d'installation ne doit plus être
 * une source de mystère.
 *
 * Depuis npm 12 (juillet 2026), les scripts `install`/`postinstall` des dépendances sont
 * **bloqués par défaut** : `npm ci` se termine sur un `npm warn install-scripts` et l'install
 * reste silencieusement incomplète pour les paquets qui en dépendent réellement. Sur ce dépôt,
 * deux paquets sont concernés (`sharp`, `unrs-resolver`) — et `sharp` est celui dont dépend
 * l'optimisation d'images en production (`next start`), donc exactement le genre de gap qui se
 * traduit plus tard par un `/_next/image` en 500 sans rapport apparent avec une modification.
 *
 * Ce fichier verrouille trois choses :
 * 1. `allowScripts` couvre bien toute dépendance installée qui a un script d'installation
 *    utile (les `prepare` ne comptent pas : ils ne s'exécutent que sur install depuis une
 *    source, jamais depuis un tarball du registre) ;
 * 2. `sharp` se charge **pour de vrai** (libvips résolu) — si un jour l'approbation est
 *    retirée ou le binaire absent, l'échec arrive ici, pas en prod ;
 * 3. un refus explicite (`false`) reste une réponse valable, et n'est pas un oubli.
 */
import fs from "node:fs";
import path from "node:path";

const RACINE = process.cwd();
const MANIFEST = path.join(RACINE, "package.json");

type Paquet = { nom: string; version: string; scripts: string[] };

function paquetsAvecScript(): Paquet[] {
  const dossiers = path.join(RACINE, "node_modules");
  const out: Paquet[] = [];
  if (!fs.existsSync(dossiers)) return out; // `npm ci` pas encore joué: rien à vérifier
  const inspecter = (dossier: string, prefixe = "") => {
    for (const entree of fs.readdirSync(dossier)) {
      const plein = path.join(dossier, entree);
      if (entree.startsWith("@") && !prefixe) inspecter(plein, `${entree}/`);
      else if (!entree.startsWith(".")) {
        const manifest = path.join(plein, "package.json");
        if (!fs.existsSync(manifest)) continue;
        let pkg: { name?: string; version?: string; scripts?: Record<string, string> };
        try {
          pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
        } catch {
          continue;
        }
        const scripts = ["preinstall", "install", "postinstall"].filter((k) => pkg.scripts?.[k]);
        if (scripts.length) out.push({ nom: `${prefixe}${entree}`, version: pkg.version ?? "", scripts });
      }
    }
  };
  inspecter(dossiers);
  return out;
}

describe("allowScripts (npm ≥ 12)", () => {
  const projet = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as {
    allowScripts?: Record<string, boolean>;
  };

  it("le projet déclare une politique allowScripts", () => {
    expect(projet.allowScripts).toBeTruthy();
    expect(typeof projet.allowScripts).toBe("object");
  });

  it("toute dépendance avec un script d'installation utile est couverte par la politique", () => {
    const politique = projet.allowScripts ?? {};
    const entrees = Object.keys(politique);
    const manquants = paquetsAvecScript()
      .filter((p) => !entrees.some((e) => e === p.nom || e === `${p.nom}@${p.version}` || e.startsWith(`${p.nom}@`)))
      .map((p) => `${p.nom}@${p.version} (${p.scripts.join(",")})`);
    // Un paquet couvert par un refus explicite n'est pas un oubli: il est refusé sciemment.
    const refuses = paquetsAvecScript()
      .filter((p) => entrees.some((e) => (e === p.nom || e.startsWith(`${p.nom}@`)) && politique[e] === false))
      .map((p) => p.nom);
    expect(manquants.filter((m) => !refuses.some((r) => m.startsWith(r)))).toEqual([]);
  });

  it("sharp se charge réellement, sinon l'optimisation d'images de production est morte", () => {
    let sharp: { versions?: Record<string, string> } | undefined;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      sharp = require("sharp");
    } catch (e) {
      fail(
        `sharp introuvable ou non fonctionnel (${(e as Error).message.split("\n")[0]}). ` +
          "Sous npm ≥ 12 : `npm install-scripts approve sharp && npm rebuild sharp`."
      );
    }
    expect(sharp).toBeTruthy();
    expect(sharp!.versions?.vips || "").toMatch(/^\d+\.\d+/);
  });
});
