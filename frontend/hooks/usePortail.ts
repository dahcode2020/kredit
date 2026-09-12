"use client";
/**
 * Intention d'entrée au portail — le seul état qui voyage entre la page d'accueil et `/auth`.
 *
 * Volontairement **non persisté** : c'est un clic, pas une session. Un rôle mémorisé dans
 * localStorage serait un rôle qui survit à une déconnexion, et la page d'authentification le
 * relirait comme si de rien n'était. Ici, recharger la page ramène le visiteur sur « Client ».
 *
 * Et pas de `?role=admin` dans l'URL : `useSearchParams` sur une page prerendered impose une
 * frontière `<Suspense>` et rend la page dynamique pour un simple présélection — un état de 4 champs
 * ne vaut pas une page non statique.
 */
import { create } from "zustand";
import type { Role } from "@/lib/auth-service";

type EtatPortail = {
  role: Role;
  email: string;
  /** Présent uniquement quand un compte de démonstration a été cliqué (jamais saisi par un visiteur). */
  motDePasseDemo: string;
  motivation: "connexion" | "inscription";
  choisirRole: (role: Role) => void;
  choisirCompteDemo: (email: string, motDePasse: string) => void;
  basculer: (motivation: "connexion" | "inscription") => void;
  oublier: () => void;
};

export const usePortail = create<EtatPortail>((set) => ({
  role: "CUSTOMER",
  email: "",
  motDePasseDemo: "",
  motivation: "connexion",
  choisirRole: (role) => set({ role }),
  // Le compte de démo remplit aussi son mot de passe: un champ vide qui « devrait » être rempli fait
  // douter du reste de la page. L'état ne vit qu'un aller simple accueil -> /auth.
  choisirCompteDemo: (email, motDePasse) => set({ email, motDePasseDemo: motDePasse, motivation: "connexion" }),
  basculer: (motivation) => set({ motivation }),
  oublier: () => set({ email: "", motDePasseDemo: "", motivation: "connexion" }),
}));
