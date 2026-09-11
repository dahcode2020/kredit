"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useSyncExternalStore } from "react";

type User = { id: string; email: string; role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN"; locale: string; firstName?: string; lastName?: string };
type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  login: (u: User, accessToken: string, refreshToken?: string | null) => void;
  logout: () => void;
  setUser: (u: Partial<User>) => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      login: (user, accessToken, refreshToken = null) => {
        // compat: also keep legacy keys for api.client
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem("accessToken", accessToken);
            if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
            localStorage.setItem("user", JSON.stringify(user));
          }
        } catch {}
        set({ user, accessToken, refreshToken });
      },
      logout: () => {
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("user");
          }
        } catch {}
        set({ user: null, accessToken: null, refreshToken: null });
      },
      setUser: (patch) => {
        const cur = get().user;
        if (!cur) return;
        const next = { ...cur, ...patch };
        try {
          if (typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(next));
        } catch {}
        set({ user: next });
      },
    }),
    {
      name: "kredit-auth",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") return localStorage;
        // SSR fallback: memory no-op
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        } as any;
      }),
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken }),
      // Important: skipHydration évite le mismatch SSR/CSR où le client aurait déjà user != null au premier render
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        // appelé après rehydrate (sync pour localStorage), marque comme hydraté
        state?.setHasHydrated(true);
        // sync legacy keys for api.client that reads localStorage directly
        try {
          if (typeof window !== "undefined" && state?.accessToken) {
            localStorage.setItem("accessToken", state.accessToken);
            if (state.refreshToken) localStorage.setItem("refreshToken", state.refreshToken);
            if (state.user) localStorage.setItem("user", JSON.stringify(state.user));
          }
        } catch {}
      },
    }
  )
);

// Helper pour les composants qui doivent attendre l'hydratation du store avant de décider
// de l'état connecté. `isAuthenticated` reste false tant que `_hasHydrated` est false :
// le premier rendu du client est ainsi identique au HTML du serveur (pas de mismatch),
// et le squelette est remplacé juste après l'hydratation.
export function useAuthHydrated() {
  const hasHydrated = useAuth((s) => s._hasHydrated);
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.accessToken);

  useEffect(() => {
    if (hasHydrated) return;
    let cancelled = false;
    // Filet de sécurité: `_hasHydrated` doit passer true MÊME si la rehydratation échoue
    // (JSON corrompu dans localStorage, storage bloqué en navigation privée, quota dépassé).
    // Sinon le composant reste bloqué sur le squelette « non connecté » à chaque refresh.
    const finish = () => {
      if (!cancelled && !useAuth.getState()._hasHydrated) useAuth.setState({ _hasHydrated: true });
    };
    try {
      const r = (useAuth as any).persist?.rehydrate?.();
      if (r && typeof r.then === "function") r.then(finish, finish);
      else finish();
    } catch {
      finish();
    }
    return () => { cancelled = true; };
  }, [hasHydrated]);

  return { hasHydrated, isAuthenticated: hasHydrated && !!user && !!token, user, token };
}

/**
 * Contenus « client-only » (localStorage, taille d'écran, heure locale…) : à n'afficher
 * qu'après hydratation. `useSyncExternalStore` plutôt qu'un `useState`+`useEffect` parce que
 * le snapshot serveur (`false`) est lu de façon synchrone par React, y compris sous
 * Suspense/streaming — un flag posé en effect peut être raté et réintroduire le mismatch.
 */
const subscribeNoop = () => () => {};
export function useHasMounted() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
}

