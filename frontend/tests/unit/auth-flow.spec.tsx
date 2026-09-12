/**
 * Le portail (connexion / inscription) et le chemin simulation → demande.
 *
 * Ce fichier verrouille quatre choses qui, sinon, cassent en silence :
 *
 * 1. **le rôle ne se choisit pas, il se constate** : la puce « Super administrateur » de l'interface
 *    n'accorde rien. `seConnecter` renvoie le rôle du compte trouvé ; si l'écran devient un
 *    sélecteur de droits, plus rien ne sépare un client d'un back-office ;
 * 2. **pas de connexion bidon** : un mot de passe qui ne correspond pas renvoie `INVALIDE`. Une démo
 *    qui accepte n'importe quoi forme tout le monde à croire que l'écran protège quelque chose ;
 * 3. **le second facteur est décidé par le service**, pas par la page (`mfaRequis` sur la réponse) ;
 * 4. **l'intention venue d'ailleurs est appliquée en effet** : le premier rendu client doit coller au
 *    HTML servi, sinon la page de connexion — la plus visitée du site — devient un mismatch.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import FormulaireAuth, { hrefSelonRole } from "@/components/auth/FormulaireAuth";
import {
  COMPTES_DEMO, codeMfaValide, emailValide, forceDuMotDePasse, motDePasseValide, referenceDossier,
  roleAttendu, sInscrire, seConnecter, telephoneValide,
} from "@/lib/auth-service";
import { useDemande } from "@/hooks/useDemande";
import { usePortail } from "@/hooks/usePortail";
import { t, tNs } from "@/lib/i18n";

const ROOT = join(__dirname, "..", "..");

describe("rôles et destinations", () => {
  it("un rôle, un écran — et le back-office n'est jamais le client", () => {
    expect(hrefSelonRole("fr", "CUSTOMER")).toBe("/fr/dashboard");
    expect(hrefSelonRole("fr", "ADMIN")).toBe("/fr/admin/dashboard");
    expect(hrefSelonRole("fr", "SUPER_ADMIN")).toBe("/fr/super");
    expect(hrefSelonRole("de", "ADMIN")).toBe("/de/admin/dashboard");
  });

  it("l'indice d'adresse ne vaut pas autorisation", async () => {
    expect(roleAttendu("admin@kredit.be")).toBe("ADMIN");
    expect(roleAttendu("super@kredit.be")).toBe("SUPER_ADMIN");
    expect(roleAttendu("nimporte@kredit.be")).toBe("CUSTOMER");
    // Le compte trouvé décide : un visiteur qui a sélectionné « Super administrateur » dans l'interface
    // avec une adresse client obtient… le rôle client, et pas un accès.
    const res = await seConnecter({ email: "customer@kredit.be", motDePasse: "Customer123!", locale: "fr" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.user.role).toBe("CUSTOMER");
  });
});

describe("seConnecter", () => {
  it.each(COMPTES_DEMO)("$email entre avec son mot de passe", async (c) => {
    const res = await seConnecter({ email: c.email, motDePasse: c.motDePasse, locale: "fr" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user.role).toBe(c.role);
      expect(res.mfaRequis).toBe(c.role !== "CUSTOMER");
    }
  });

  it("le back-office passe par le second facteur, le client non", async () => {
    const admin = await seConnecter({ email: "admin@kredit.be", motDePasse: "Admin123!", locale: "fr" });
    const client = await seConnecter({ email: "customer@kredit.be", motDePasse: "Customer123!", locale: "fr" });
    expect(admin.ok && admin.mfaRequis).toBe(true);
    expect(client.ok && !client.mfaRequis).toBe(true);
  });

  it("un mot de passe erroné ne connecte pas « quand même, c'est une démo »", async () => {
    const res = await seConnecter({ email: "admin@kredit.be", motDePasse: "Admin123", locale: "fr" });
    expect(res).toEqual({ ok: false, code: "INVALIDE" });
  });

  it("un champ vide n'appelle pas le réseau", async () => {
    expect(await seConnecter({ email: "pas-une-adresse", motDePasse: "x", locale: "fr" })).toMatchObject({ ok: false, code: "CHAMP", champ: "email" });
    expect(await seConnecter({ email: "customer@kredit.be", motDePasse: "", locale: "fr" })).toMatchObject({ ok: false, code: "CHAMP", champ: "motDePasse" });
  });

  it("la casse de l'adresse n'est pas un second facteur d'échec", async () => {
    const res = await seConnecter({ email: "  Customer@KREDIT.BE ", motDePasse: "Customer123!", locale: "fr" });
    expect(res.ok).toBe(true);
  });
});

describe("sInscrire", () => {
  const bon = { prenom: "Élise", nom: "Moreau", email: "elise.moreau@exemple.be", motDePasse: "Kredit2026!", telephone: "+32470123456", locale: "fr", accepteGdpr: true };

  it("un dossier complet crée un client", async () => {
    const res = await sInscrire(bon);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.user.role).toBe("CUSTOMER");
      expect(res.user.email).toBe("elise.moreau@exemple.be");
      expect(res.accessToken).toMatch(/^demo\./);
    }
  });

  it("refuse un e-mail déjà pris, sans écraser le compte existant", async () => {
    const res = await sInscrire({ ...bon, email: "customer@kredit.be" });
    expect(res).toMatchObject({ ok: false, code: "EXISTS" });
  });

  it("refuse le consentement manquant — c'est une exigence légale, pas une case de plus", async () => {
    expect(await sInscrire({ ...bon, accepteGdpr: false })).toMatchObject({ ok: false, code: "CHAMP", champ: "gdpr" });
  });

  it.each([
    ["mot de passe trop court", { motDePasse: "Kredit!" }, "motDePasse"],
    ["mot de passe sans chiffre", { motDePasse: "Kreditez" }, "motDePasse"],
    ["e-mail incomplet", { email: "elise@" }, "email"],
    ["téléphone illisible", { telephone: "1234" }, "telephone"],
    ["nom manquant", { nom: "  " }, "nom"],
  ])("%s", async (_nom, patch, champ) => {
    const res = await sInscrire({ ...bon, ...(patch as object) });
    expect(res).toMatchObject({ ok: false, code: "CHAMP", champ });
  });
});

describe("validateurs", () => {
  it.each([["a@b.be", true], ["a@b", false], [" a b@c.be", false], ["", false]])("emailValide(%s) = %s", (v, attendu) => {
    expect(emailValide(v as string)).toBe(attendu);
  });

  it("la force du mot de passe est bornée et monotone", () => {
    expect(forceDuMotDePasse("")).toBe(0);
    expect(forceDuMotDePasse("abc")).toBeLessThanOrEqual(1);
    expect(forceDuMotDePasse("Kredite2026!")).toBeGreaterThanOrEqual(3);
    expect(forceDuMotDePasse("Kredite2026!")).toBeLessThanOrEqual(4);
    expect(motDePasseValide("Kredite2026!")).toBe(true);
    expect(motDePasseValide("kredite!")).toBe(false); // pas de chiffre
  });

  it("le téléphone est facultatif, mais pas n'importe quoi", () => {
    expect(telephoneValide("")).toBe(true);
    expect(telephoneValide("+32470123456")).toBe(true);
    expect(telephoneValide("0470/12 34 56")).toBe(true);
    expect(telephoneValide("1234")).toBe(false);
  });

  it("le code MFA est strict, la page ne « fait pas confiance » sur 5 chiffres", () => {
    expect(codeMfaValide("123456")).toBe(true);
    expect(codeMfaValide("12345")).toBe(false);
    expect(codeMfaValide("12 34 5x")).toBe(false);
  });

  it("la référence de dossier est lisible et stable en forme", () => {
    const ref = referenceDossier(new Date("2026-09-12T10:00:00Z"));
    expect(ref).toMatch(/^KR-2609-[A-Z0-9]{4}$/);
  });
});

describe("brouillon de demande (simulateur -> formulaire)", () => {
  const brouillon = {
    produit: "PERSONAL" as const, montant: 15_000, duree: 48, revenu: 3_200, charges: 600, credits: 250,
    typeRevenu: "SALARY", statut: "CDI", objet: "VEHICLE", mensualite: 328.71, taeg: 0.0275, interets: 778.1,
    coutTotal: 15_928.1, score: 95, grade: "A", recommandation: "APPROVE_RECOMMENDATION", simulateLe: "2026-09-12T10:00:00.000Z",
  };

  beforeEach(() => {
    useDemande.setState({ simulation: null, champs: {}, etape: 0, depots: [], _hydrated: true });
  });

  it("la simulation posée survit au changement d'étape et se transmet au dépôt", () => {
    useDemande.getState().poserSimulation(brouillon);
    expect(useDemande.getState().simulation?.montant).toBe(15_000);

    useDemande.getState().majChamp({ prenom: "Élise", ville: "Ixelles" });
    expect(useDemande.getState().champs.prenom).toBe("Élise");

    useDemande.getState().allerA(9); // hors bornes: on reste à la dernière étape
    expect(useDemande.getState().etape).toBe(3);

    useDemande.getState().deposer({ reference: "KR-2609-AB12", simulation: brouillon, champs: { prenom: "Élise" } });
    const apres = useDemande.getState();
    expect(apres.depots).toHaveLength(1);
    expect(apres.depots[0].champs.prenom).toBe("Élise");
    // Un dossier déposé libère le brouillon: le remplir une seconde fois ne doit pas ressuyer le premier.
    expect(apres.simulation).toBeNull();
    expect(apres.champs).toEqual({});
  });

  it("vider efface le brouillon sans effacer l'historique de session", () => {
    useDemande.getState().poserSimulation(brouillon);
    useDemande.getState().deposer({ reference: "KR-2609-CD34", simulation: brouillon, champs: {} });
    useDemande.getState().vider();
    expect(useDemande.getState().simulation).toBeNull();
    expect(useDemande.getState().depots).toHaveLength(1);
  });
});


describe("idiome `ta()` du portail — chaque clé existe dans les quatre langues", () => {
  // Le composant appelle `tNs(locale, "auth", cle)` via un raccourci `ta(cle)`. Le test de clés
  // général (i18n-keys-usage) reconnaît `tr("a.b")` et `t(locale, "a.b")`, pas cette écriture: sans ce
  // contrôle, une clé ajoutée en français seulement rendrait « erreur.plage » à un lecteur néerlandais,
  // exactement le défaut que ce dépôt a déjà payé une fois.
  const fichiers = [
    "components/auth/FormulaireAuth.tsx",
    "components/auth/Mascotte.tsx",
    "components/credit/FormDemande.tsx",
    "app/[locale]/auth/page.tsx",
    "app/[locale]/demande/page.tsx",
  ];
  const cles = new Set<string>();
  for (const f of fichiers) {
    const src = readFileSync(join(ROOT, f), "utf8");
    for (const m of src.matchAll(/ta\(\s*"([a-zA-Z0-9._]+)"/g)) cles.add(m[1]);
    for (const m of src.matchAll(/ta\(\s*`([a-zA-Z0-9._]+)\$\{([^}]+)\}`/g)) cles.add(m[1] + "<dynamic>");
    for (const m of src.matchAll(/tNs\(\s*locale,\s*"auth",\s*"([a-zA-Z0-9._]+)"/g)) cles.add(m[1]);
    // Les clés construites à la volée (`"foyer." + c`, `LIBELLES_ROLE[r]`) sont vérifiées séparément.
    for (const m of src.matchAll(/ta\(\s*"([a-zA-Z0-9._]+)"\s*\+/g)) cles.add(m[1] + "<préfixe>");
  }

  it("les clés littérales se résolvent partout", () => {
    // Un préfixe suivi de concaténation (`"foyer." + code`) finit par un point: ce n’est pas une clé,
    // la famille est vérifiée séparément plus bas.
    const statiques = [...cles].filter((c) => !c.includes("<") && !c.endsWith("."));
    expect(statiques.length).toBeGreaterThan(20);
    // Une seule assertion, la liste complète en cas d'échec: énumérer les clés manquantes est plus
    // utile que tomber sur la première.
    const manquantes: string[] = [];
    for (const cle of statiques) {
      for (const locale of ["fr", "en", "nl", "de"] as const) {
        const rendu = tNs(locale, "auth", cle);
        if (rendu === cle || !rendu) manquantes.push(`auth:${cle} (${locale})`);
      }
    }
    expect(manquantes).toEqual([]);
  });

  it("les familles de clés dynamiques sont complètes", () => {
    // `foyer.<c>` (cinq situations familiales), `role.<x>` (trois rôles), `simulator.tab.<produit>`
    // (quatre produits, namespace credit): ce sont des clés construites à la volée, donc aucune ne
    // serait repérée en comparant des littéraux dans le code.
    const absentes: string[] = [];
    const locales = ["fr", "en", "nl", "de"] as const;
    for (const locale of locales) {
      for (const code of ["celibataire", "marie", "cohabite", "divorce", "veuf"]) {
        if (tNs(locale, "auth", "foyer." + code).startsWith("foyer.")) absentes.push(`auth:foyer.${code} (${locale})`);
      }
      for (const r of ["role.client", "role.admin", "role.super"]) {
        if (tNs(locale, "auth", r) === r) absentes.push(`auth:${r} (${locale})`);
      }
      for (const produit of ["PERSONAL", "MORTGAGE", "BUSINESS", "INVESTMENT"]) {
        const cle = `simulator.tab.${produit}`;
        if (t(locale, cle) === cle) absentes.push(cle + ` (${locale})`);
      }
    }
    expect(absentes).toEqual([]);
  });
});

describe("formulaire du portail (rendu client)", () => {
  async function monter() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root: Root | undefined;
    await act(async () => {
      root = createRoot(container);
      root.render(<FormulaireAuth locale="fr" />);
    });
    await act(async () => { await Promise.resolve(); });
    return {
      container,
      async demo() { await act(async () => root?.unmount()); container.remove(); },
    };
  }

  it("les deux modes sont rendus, sans valeur pré-remplie côté serveur", async () => {
    const { container, demo } = await monter();
    const texte = container.textContent ?? "";
    expect(texte).toContain("Se connecter");
    expect(texte).toContain("Créer un compte");
    // Le premier rendu ne connaît pas encore l'intention de la page d'accueil: aucun champ rempli.
    const email = container.querySelector('input[type="email"]') as HTMLInputElement;
    expect(email.value).toBe("");
    await demo();
  });

  it("l'intention du portail (compte de démo cliqué) arrive en effet, pas au render", async () => {
    usePortail.getState().choisirCompteDemo("customer@kredit.be", "Customer123!");
    const { container, demo } = await monter();
    const email = container.querySelector('input[type="email"]') as HTMLInputElement;
    const mdp = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(email.value).toBe("customer@kredit.be");
    expect(mdp.value).toBe("Customer123!");
    // Et l'intention est consommée: un rechargement repart du rôle client, champ vide.
    expect(usePortail.getState().email).toBe("");
    await demo();
  });

  it("un envoi à vide réclame les champs requis au lieu d'appeler le réseau", async () => {
    const { container, demo } = await monter();
    const formulaire = container.querySelector("form")!;
    await act(async () => {
      formulaire.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    // En mode connexion, un e-mail manquant est une *forme* d'adresse incomplète: le message vient du
    // dictionnaire, pas d'un « required » natif du navigateur (introuvable en test, et non traduit).
    expect(container.textContent).toContain("Adresse e-mail incomplète.");
    await demo();
  });

  it("le compte admin bascule sur l'écran du second facteur, et n'ouvre rien avant le code", async () => {
    usePortail.getState().choisirCompteDemo("admin@kredit.be", "Admin123!");
    const { container, demo } = await monter();
    const formulaire = container.querySelector("form")!;
    await act(async () => {
      formulaire.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    // La réponse de `seConnecter` est un appel réseau simulé: on laisse la microtâche se résoudre.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain("Vérification en 2 étapes");
    // Toujours aucune session écrite: le MFA n'est pas décoratif.
    expect(container.textContent).not.toContain("Content de vous revoir");
    await demo();
  });
});
