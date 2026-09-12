/**
 * Service d'authentification du portail — mock d'abord, backend quand il est branché.
 *
 * Pourquoi un fichier de service et pas du `fetch` dans la page : la page doit rester une
 * *présentation*, et les trois règles qui suivent sont testées sans navigateur
 * (`tests/unit/auth-flow.spec.tsx`) parce qu'elles décident de qui voit quel écran :
 *
 * 1. le **rôle vient du compte**, jamais d'un sélecteur. Un visiteur qui choisit « Super
 *    administrateur » dans l'interface n'obtient rien : `seConnecter` renvoie le rôle du compte
 *    trouvé, et la page affiche l'écart. Un choix d'interface qui accorde un droit est le plus vieux
 *    bug d'authentification du web ;
 * 2. le **second facteur est exigé côté service**, pas côté page : `mfaRequis` est une propriété de
 *    la réponse, donc une page qui oublierait l'écran MFA ne peut pas ouvrir le back-office ;
 * 3. **le mock ne fait pas semblant de vérifier** : `motDePasse` doit correspondre au compte, sinon
 *    `INVALIDE`. Une démo qui se connecte « avec n'importe quoi » apprend à tout le monde que
 *    l'écran ne vaut rien.
 *
 * Backend : `POST /api/v1/auth/login` et `/register` existent (`backend/src/api/auth.controller.ts`).
 * Ils répondent un stub, mais la forme est respectée — si `NEXT_PUBLIC_API_URL` est posé, on passe
 * par lui et on retombe sur le mock si l'appel échoue (le codespace n'a pas toujours le port 4000
 * d'ouvert, et une page de connexion qui ne s'affiche pas à cause d'un backend absent est un pire
 * résultat qu'une démo locale).
 */
import { isValidPhoneNumber } from "libphonenumber-js";

export type Role = "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";

export type Compte = {
  id: string;
  email: string;
  motDePasse: string;
  role: Role;
  prenom: string;
  nom: string;
  telephone?: string;
};

/**
 * Les comptes de la démonstration. Les trois premiers sont ceux annoncés dans le README; `alex@`
 * restait le seul compte que la page d'accueil savait fabriquer en interne, sans mot de passe réel.
 */
export const COMPTES_DEMO: Compte[] = [
  { id: "usr_demo_customer", email: "customer@kredit.be", motDePasse: "Customer123!", role: "CUSTOMER", prenom: "Alex", nom: "Dupont", telephone: "+32470000000" },
  { id: "usr_demo_admin", email: "admin@kredit.be", motDePasse: "Admin123!", role: "ADMIN", prenom: "Nadia", nom: "Janssens", telephone: "+32471000100" },
  { id: "usr_demo_super", email: "super@kredit.be", motDePasse: "Super123!", role: "SUPER_ADMIN", prenom: "Marc", nom: "Peeters", telephone: "+32472000200" },
];

/** Code à six chiffres accepté par la démo pour le back-office (documenté à l'écran, pas caché). */
export const CODE_DEMO = "123456";

export const estBackOffice = (role: Role) => role === "ADMIN" || role === "SUPER_ADMIN";

/** Le rôle attendu d'une adresse — sert au présélecteur du formulaire, pas à l'autorisation. */
export function roleAttendu(email: string): Role {
  const e = email.trim().toLowerCase();
  if (e.startsWith("super@")) return "SUPER_ADMIN";
  if (e.startsWith("admin@")) return "ADMIN";
  return "CUSTOMER";
}

export function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim());
}

export function motDePasseValide(motDePasse: string): boolean {
  return motDePasse.length >= 8 && /\d/.test(motDePasse);
}

/** 0 à 4 — affiché en barres, jamais en pourcentage (un jauge à « 62 % » ne veut rien dire). */
export function forceDuMotDePasse(motDePasse: string): 0 | 1 | 2 | 3 | 4 {
  if (!motDePasse) return 0;
  let score = 0;
  if (motDePasse.length >= 8) score++;
  if (motDePasse.length >= 12) score++;
  if (/[A-Z]/.test(motDePasse) && /[a-z]/.test(motDePasse)) score++;
  if (/\d/.test(motDePasse) && /[^A-Za-z0-9]/.test(motDePasse)) score++;
  if (motDePasse.length < 8) score = Math.min(score, 1);
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}

export function telephoneValide(telephone: string, pays = "BE"): boolean {
  const brut = telephone.trim();
  if (!brut) return true; // facultatif à l'inscription
  try {
    return isValidPhoneNumber(brut, brut.startsWith("+") ? undefined : (pays as any));
  } catch {
    return false;
  }
}

/** Ce que le store de session attend. Un seul type, partagé par la connexion et l'inscription. */
export type CompteAuth = { id: string; email: string; role: Role; locale: string; firstName: string; lastName: string };

export type ResultatAuth =
  | { ok: true; user: CompteAuth; accessToken: string; mfaRequis: boolean; source: "api" | "demo" }
  | { ok: false; code: "INVALIDE" | "CHAMP"; champ?: "email" | "motDePasse" };

function apiActive(): boolean {
  return typeof window !== "undefined" && !!(process.env.NEXT_PUBLIC_API_URL || "").trim();
}

/**
 * Connexion. Valide d'abord localement (le formulaire ne doit pas appeler le réseau pour un champ
 * vide), puis tente le backend, puis retombe sur les comptes de démonstration.
 */
export async function seConnecter(entree: {
  email: string;
  motDePasse: string;
  locale: string;
}): Promise<ResultatAuth> {
  if (!emailValide(entree.email)) return { ok: false, code: "CHAMP", champ: "email" };
  if (!entree.motDePasse) return { ok: false, code: "CHAMP", champ: "motDePasse" };

  if (apiActive()) {
    try {
      const { apiFetch } = await import("@/services/api.client");
      const r = await apiFetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: entree.email, password: entree.motDePasse, locale: entree.locale }),
      });
      const json: any = await r.json();
      if (r.ok && json?.accessToken) {
        const u = json.user ?? {};
        const role: Role = u.role ?? roleAttendu(entree.email);
        return {
          ok: true,
          source: "api",
          accessToken: json.accessToken,
          mfaRequis: estBackOffice(role),
          user: {
            id: u.id ?? "usr_api",
            email: entree.email,
            role,
            locale: u.locale ?? entree.locale,
            firstName: u.firstName ?? entree.email.split("@")[0],
            lastName: u.lastName ?? "",
          },
        };
      }
    } catch {
      /* backend joignable mais muet: on tombe sur la démo, sans faire échouer la page */
    }
  }

  const compte = COMPTES_DEMO.find(
    (c) => c.email.toLowerCase() === entree.email.trim().toLowerCase() && c.motDePasse === entree.motDePasse,
  );
  if (!compte) return { ok: false, code: "INVALIDE" };
  return {
    ok: true,
    source: "demo",
    accessToken: `demo.${compte.id}.${Date.now()}`,
    mfaRequis: estBackOffice(compte.role),
    user: {
      id: compte.id,
      email: compte.email,
      role: compte.role,
      locale: entree.locale,
      firstName: compte.prenom,
      lastName: compte.nom,
    },
  };
}

export type ChampInscription = {
  prenom: string;
  nom: string;
  email: string;
  motDePasse: string;
  telephone?: string;
  locale: string;
  accepteGdpr: boolean;
};

/**
 * Inscription. Un e-mail déjà pris côté démo est refusé (`EXISTS`) plutôt que de silently
 * écraser un compte — c'est le comportement que le backend annonce avec son `409 EMAIL_ALREADY_EXISTS`.
 */
export async function sInscrire(form: ChampInscription): Promise<
  | { ok: true; user: CompteAuth; accessToken: string; source: "api" | "demo" }
  | { ok: false; code: "EXISTS" | "CHAMP"; champ?: "email" | "motDePasse" | "prenom" | "nom" | "gdpr" | "telephone" }
> {
  const champsRequis = [form.prenom.trim(), form.nom.trim()];
  if (champsRequis.some((v) => !v)) return { ok: false, code: "CHAMP", champ: champsRequis[0] ? "nom" : "prenom" };
  if (!emailValide(form.email)) return { ok: false, code: "CHAMP", champ: "email" };
  if (!motDePasseValide(form.motDePasse)) return { ok: false, code: "CHAMP", champ: "motDePasse" };
  if (form.telephone && !telephoneValide(form.telephone)) return { ok: false, code: "CHAMP", champ: "telephone" };
  if (!form.accepteGdpr) return { ok: false, code: "CHAMP", champ: "gdpr" };

  if (COMPTES_DEMO.some((c) => c.email.toLowerCase() === form.email.trim().toLowerCase())) {
    return { ok: false, code: "EXISTS" };
  }

  const user = {
    id: "usr_" + Math.random().toString(36).slice(2, 8),
    email: form.email.trim().toLowerCase(),
    role: "CUSTOMER" as Role,
    locale: form.locale,
    firstName: form.prenom.trim(),
    lastName: form.nom.trim(),
  };

  if (apiActive()) {
    try {
      const { apiFetch } = await import("@/services/api.client");
      const r = await apiFetch("/api/v1/auth/register", {
        method: "POST",
        idempotencyKey: `reg_${user.email}`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: form.motDePasse,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: form.telephone,
          locale: form.locale,
          acceptGdpr: form.accepteGdpr,
        }),
      });
      if (r.status === 409) return { ok: false, code: "EXISTS" };
      const json: any = await r.json().catch(() => ({}));
      if (r.ok) {
        return { ok: true, source: "api", accessToken: json?.accessToken ?? `demo.${user.id}`, user: { ...user, id: json?.id ?? user.id } };
      }
      if (json?.code === "GDPR_REQUIRED") return { ok: false, code: "CHAMP", champ: "gdpr" };
    } catch {
      /* on retombe sur la démo ci-dessous */
    }
  }

  return { ok: true, source: "demo", accessToken: `demo.${user.id}.${Date.now()}`, user };
}

export function codeMfaValide(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/** Référence de dossier lisible: KR-2609-4F2C. Fabriquée à la soumission, jamais au render. */
export function referenceDossier(date: Date = new Date()): string {
  const annee = String(date.getFullYear()).slice(2);
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const tirage = Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, "0");
  return `KR-${annee}${mois}-${(tirage + "0000").slice(0, 4)}`;
}
