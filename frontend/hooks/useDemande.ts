"use client";
/**
 * Brouillon de demande de crédit — le pont entre le simulateur et le formulaire d'inscription.
 *
 * C'est la demande du brief made concrète : « la demande renvoie vers un formulaire d'inscription
 * bien détaillé en tenant compte des données de la simulation ». Sans transport, cette phrase veut
 * dire que l'utilisateur ressaisit ce qu'il vient de calculer — et dans un parcours de crédit, la
 * ressaisie est l'étape où l'on décroche.
 *
 * Trois choix de structure :
 *
 * - **persisté**, parce qu'un formulaire de quatre étapes se fait à cheval sur deux sessions (un
 *   ongle, un métro, un enfant qui appelle) : `skipHydration` + un drapeau `_hydrated`, comme
 *   `useAuth`, pour que le premier rendu client reste identique au HTML servi ;
 * - le **brouillon porte la simulation ET les réponses** du formulaire : la simulation seule ne
 *   suffirait pas à reprendre l'écran où il était ;
 * - les **dépôts** (`depots`) sont séparés du brouillon : un dossier déposé ne se modifie plus depuis
 *   cet écran, et un `effacerBrouillon` qui écraserait l'historique serait un bug de démo
 *   embarrassant — le dépôt est ce que le conseiller verra.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect } from "react";
import type { ProductCode } from "@/lib/credit-engine";

export type BrouillonSimulation = {
  produit: ProductCode;
  montant: number;
  duree: number;
  revenu: number;
  charges: number;
  credits: number;
  typeRevenu: string;
  statut: string;
  objet: string;
  mensualite: number;
  taeg: number;
  interets: number;
  coutTotal: number;
  score: number;
  grade: string;
  recommandation: string;
  /** Horodatage de la simulation, posé au clic (jamais au render) pour dire si elle est fraîche. */
  simulateLe: string;
};

export type ChampsDemande = {
  prenom: string;
  nom: string;
  email: string;
  motDePasse: string;
  confirmation: string;
  telephone: string;
  naissance: string;
  nationalite: string;
  situationFamiliale: string;
  personnes: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
};

export type Depot = {
  reference: string;
  depositeLe: string;
  simulation: BrouillonSimulation | null;
  champs: Partial<ChampsDemande>;
  statut: "SOUMISE";
};

type EtatDemande = {
  simulation: BrouillonSimulation | null;
  champs: Partial<ChampsDemande>;
  etape: number;
  depots: Depot[];
  _hydrated: boolean;
  hydrater: () => void;
  poserSimulation: (s: BrouillonSimulation) => void;
  majChamp: (patch: Partial<ChampsDemande>) => void;
  allerA: (etape: number) => void;
  deposer: (d: Omit<Depot, "statut" | "depositeLe">) => void;
  vider: () => void;
};

const VIDES: ChampsDemande = {
  prenom: "", nom: "", email: "", motDePasse: "", confirmation: "", telephone: "",
  naissance: "", nationalite: "", situationFamiliale: "", personnes: "",
  adresse: "", codePostal: "", ville: "", pays: "BE",
};

export const useDemande = create<EtatDemande>()(
  persist(
    (set, get) => ({
      simulation: null,
      champs: {},
      etape: 0,
      depots: [],
      _hydrated: false,
      hydrater: () => set({ _hydrated: true }),
      poserSimulation: (simulation) => set({ simulation }),
      majChamp: (patch) => set({ champs: { ...get().champs, ...patch } }),
      allerA: (etape) => set({ etape: Math.max(0, Math.min(3, etape)) }),
      deposer: ({ reference, simulation, champs }) => {
        const depot: Depot = { reference, depositeLe: new Date().toISOString(), simulation, champs, statut: "SOUMISE" };
        set({ depots: [depot, ...get().depots].slice(0, 10), simulation: null, champs: {}, etape: 0 });
      },
      vider: () => set({ simulation: null, champs: {}, etape: 0 }),
    }),
    {
      name: "kredit-demande",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") return localStorage;
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} } as any;
      }),
      // Le brouillon seul : `depots` reste en mémoire de session. Conserver des dossiers saisis
      // dans le navigateur d'un poste partagé serait une fuite, pas une fonctionnalité.
      partialize: (s) => ({ simulation: s.simulation, champs: s.champs, etape: s.etape }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => state?.hydrater(),
    },
  ),
);

/**
 * Attend l'hydratation avant de montrer une valeur persistée, et finit marquant hydraté même si le
 * stockage est bloqué (navigation privée, quota) — sinon l'écran resterait éternellement vide, ce qui
 * est exactement le défaut que `useAuthHydrated` avait déjà corrigé côté session.
 */
export function useDemandeHydratee() {
  const hydrated = useDemande((s) => s._hydrated);
  const simulation = useDemande((s) => s.simulation);
  const champs = useDemande((s) => s.champs);
  const etape = useDemande((s) => s.etape);
  const depots = useDemande((s) => s.depots);
  // Les actions sortent par le même canal que les valeurs: un composant qui importerait
  // `useDemande.getState().deposer` court-circuiterait la garde d'hydratation.
  const majChamp = useDemande((s) => s.majChamp);
  const allerA = useDemande((s) => s.allerA);
  const deposer = useDemande((s) => s.deposer);
  const vider = useDemande((s) => s.vider);

  useEffect(() => {
    if (hydrated) return;
    let annule = false;
    const finir = () => {
      if (!annule && !useDemande.getState()._hydrated) useDemande.setState({ _hydrated: true });
    };
    try {
      const r = (useDemande as any).persist?.rehydrate?.();
      if (r && typeof r.then === "function") r.then(finir, finir);
      else finir();
    } catch {
      finir();
    }
    return () => { annule = true; };
  }, [hydrated]);

  return { pret: hydrated, simulation, champs, etape, depots, majChamp, allerA, deposer, vider, vides: VIDES };
}
