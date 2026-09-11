"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useEffect, useState } from "react";

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

// Helper for components that need to wait hydration before deciding auth
// isAuthenticated est false tant que hasHydrated === false → évite hydration mismatch (server pulse vs client pill)
export function useAuthHydrated() {
  const hasHydrated = useAuth((s) => s._hasHydrated);
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.accessToken);
  useEffect(() => {
    if (!hasHydrated) {
      // @ts-ignore persist exists
      useAuth.persist.rehydrate();
    }
  }, [hasHydrated]);
  return { hasHydrated, isAuthenticated: hasHydrated && !!user && !!token, user, token };
}

// Hook générique pour éviter hydration mismatch sur tout contenu client-only
export function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
