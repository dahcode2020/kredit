/**
 * @jest-environment node
 */
/**
 * Le contrat `.next` du Dockerfile — vérifié, pas supposé.
 *
 * `frontend/Dockerfile` fait `RUN npm run build` puis `COPY --from=builder /app/.next ./.next`.
 * Depuis que `next.config.js` rend `distDir` conditionnel (`.next-dev` en dev pour que le
 * développeur ne marche plus jamais sur son propre build), une seule des deux branches doit
 * s'appliquer au moment du build en conteneur: si `distDir` y valait `.next-dev`, le `COPY`
 * copierait un dossier vide et l'image démarrerait sur `Could not find a production build`.
 *
 * Ce fichier ne teste donc pas Next: il teste l'accord entre trois fichiers qui ne sont jamais
 * ouverts en même temps par la même personne — `next.config.js`, `Dockerfile`, et le fait que
 * `npm run build` est la commande du builder.
 */

import fs from "fs";
import path from "path";

const FRONT = path.resolve(__dirname, "..", "..");
const DOCKERFILE = path.join(FRONT, "Dockerfile");

// Les types de Next déclarent `NODE_ENV` en lecture seule (TS2540/TS2704): on passe par un alias
// typé pour le muter, seule façon de rejouer ce que le CLI fait avant de charger la config.
const env = process.env as unknown as Record<string, string | undefined>;

/** Re-charge `next.config.js` en forçant NODE_ENV, comme le ferait le CLI au démarrage. */
function configPour(nodeEnv: string | undefined) {
  const sauvegarde = env.NODE_ENV;
  // jest.resetModules et non `delete require.cache[...]`: sous Jest, le registre des modules n'est
  // PAS require.cache. Sans ça, le second require renvoyait la première évaluation (prod) et le
  // test « dev et prod sont distincts » passait à côté de son objet.
  jest.resetModules();
  if (nodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = nodeEnv;
  try {
    return require("../../next.config.js") as { distDir?: string };
  } finally {
    if (sauvegarde === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = sauvegarde;
    jest.resetModules();
  }
}

describe("distDir et le build de production", () => {
  it("écrit en production dans le dossier que le Dockerfile copie", () => {
    const cfg = configPour("production");
    const docker = fs.readFileSync(DOCKERFILE, "utf8");
    const copies = [...docker.matchAll(/COPY\s+--from=builder\s+\/app\/(\.next[\w-]*)/g)].map((m) => m[1]);
    expect(copies.length).toBeGreaterThan(0);
    expect(copies).toContain(cfg.distDir);
  });

  it("isole le dev dans un autre dossier", () => {
    const prod = configPour("production").distDir;
    const dev = configPour("development").distDir;
    expect(dev).not.toBe(prod);
    expect(dev).toBe(".next-dev");
  });

  it("le stage runtime pose NODE_ENV=production, dont dépend distDir", () => {
    // Étape finale = celle qui lance `next start`, donc celle qui doit résoudre distDir sur `.next`.
    // Le CLI le force déjà tout seul (mesuré ici: `env -u NODE_ENV next start` -> GET /fr 200 en
    // 372 ms) ; l'ancrer dans l'image rend le déploiement indépendant de ce détail de CLI.
    const docker = fs.readFileSync(DOCKERFILE, "utf8");
    const stage = docker.split(/^FROM/m).find((b) => /"npm",\s*"start"/.test(b)) || "";
    expect(stage.length).toBeGreaterThan(0);
    expect(/^ENV\s+NODE_ENV\s*=\s*production/m.test(stage)).toBe(true);
    expect(configPour("production").distDir).toBe(".next");
  });

  it("le builder passe bien par `npm run build` (donc par `next build`, pas par `next dev`)", () => {
    const docker = fs.readFileSync(DOCKERFILE, "utf8");
    expect(/RUN\s+npm\s+run\s+build/.test(docker)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(FRONT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.build).toBe("next build");
  });
});
