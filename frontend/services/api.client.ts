// Central fetcher — JWT + idempotency + correlation + offline/idempotent resilience
// Ne jamais afficher de notification d'erreur sur refresh public si backend indisponible

type ApiFetchOpts = RequestInit & { idempotencyKey?: string; _skipAuth?: boolean; _silentOffline?: boolean };

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  // 1) Zustand persist (kredit-auth)
  try {
    const raw = localStorage.getItem("kredit-auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      const t = parsed?.state?.accessToken || parsed?.accessToken;
      if (t) return t;
    }
  } catch {}
  // 2) legacy keys
  try {
    const t = localStorage.getItem("accessToken");
    if (t) return t;
  } catch {}
  // 3) zustand store direct (if hydrated)
  try {
    // dynamic import to avoid cycle, fallback to null
    const { useAuth } = require("@/hooks/useAuth");
    return useAuth.getState?.()?.accessToken ?? null;
  } catch {
    return null;
  }
}

function getBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (env) return env.replace(/\/$/, "");
  // En prod/preview, éviter http://localhost:4000 qui échoue depuis le navigateur (Codespaces/e2b)
  // Utiliser relatif si possible (Next rewrites peut proxy), sinon fallback vide -> même origin
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Si on est sur e2b.app / codespace, localhost est injoignable depuis le navigateur
    if (host.includes("e2b.app") || host.includes("githubpreview") || host.includes("codespace")) {
      return ""; // relatif -> ne déclenche pas de Failed to fetch cross-origin
    }
  }
  // Dev local classique
  return "http://localhost:4000/api/v1";
}

export async function apiFetch(path: string, init: ApiFetchOpts = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };
  // crypto.randomUUID peut manquer en http (Codespaces preview http) -> fallback
  try {
    headers["x-request-id"] = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  } catch {
    headers["x-request-id"] = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  if (init.idempotencyKey) headers["x-idempotency-key"] = init.idempotencyKey;
  if (!init._skipAuth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const base = getBase();
  // Si base vide, on fait un fetch relatif (ex: /api/v1/... via rewrites) ou on évite l'appel si backend absent
  const url = base ? `${base}${path}` : path.startsWith("/api/") ? path : `/api/v1${path.startsWith("/") ? path : `/${path}`}`;

  let res: Response;
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 8000) : null;
    res = await fetch(url, { ...init, headers, signal: controller?.signal as any } as any);
    if (timeout) clearTimeout(timeout);
  } catch (e: any) {
    const isAbort = e?.name === "AbortError";
    const msg = isAbort ? "Délai dépassé — serveur injoignable" : e?.message || "Network error";
    // Ne pas polluer l'UX sur refresh public : logger en console, retourner objet offline silencieux si demandé
    if (typeof window !== "undefined") console.warn(`[apiFetch] ${isAbort ? "timeout" : "network"} ${path}:`, msg);
    // Pour les pages publiques, on ne throw pas de notification intrusive — le caller peut décider
    // On throw une erreur enrichie avec code OFFLINE pour que l'UI affiche OfflineBanner plutôt qu'une toast rouge
    const err: any = new Error(isAbort ? "Serveur injoignable (timeout)" : "Connexion au serveur impossible — vérifiez votre réseau.");
    err.code = "OFFLINE";
    err.status = 503;
    err.path = path;
    err.offline = true;
    // Si le caller a demandé silencieux, retourner un objet offline au lieu de throw (évite notification sur refresh home)
    if (init._silentOffline) return { _offline: true, code: "OFFLINE", statusCode: 503, message: err.message, path } as any;
    throw err;
  }

  // 503 OFFLINE venant du SW (X-KREDIT-Offline)
  if (res.status === 503 && res.headers.get("X-KREDIT-Offline")) {
    const body = await res.json().catch(() => ({}));
    if (init._silentOffline) return { _offline: true, ...body, statusCode: 503 } as any;
    const err: any = new Error(body.message || "Hors ligne — données financières non disponibles hors connexion.");
    err.code = "OFFLINE";
    err.status = 503;
    throw err;
  }

  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    const message = body.message || body.error || `API ${res.status}`;
    const err: any = new Error(message);
    err.status = res.status;
    err.code = body.code || body.error || `HTTP_${res.status}`;
    err.body = body;
    // 401 -> nettoyer l'auth (token expiré) mais ne pas afficher d'erreur intrusive sur refresh public si _skipAuth
    if (res.status === 401 && typeof window !== "undefined" && !init._skipAuth) {
      try {
        const { useAuth } = require("@/hooks/useAuth");
        const cur = useAuth.getState?.();
        if (cur?.user) {
          console.warn("[apiFetch] 401 — session expirée, déconnexion silencieuse");
          // ne pas logout automatiquement sur page publique home (évite boucle) — seulement si on était authentifié
          // On laisse le caller décider, mais on nettoie le token invalide pour éviter boucle 401
          // cur.logout?.(); // décommenter si besoin de forcer logout
        }
      } catch {}
    }
    throw err;
  }

  // 204 No Content
  if (res.status === 204) return null as any;
  const text = await res.text();
  if (!text) return null as any;
  try {
    return JSON.parse(text);
  } catch {
    return text as any;
  }
}

// Helper pour les callers qui veulent un fetch silencieux (pas de toast sur refresh)
export function apiFetchSilent(path: string, init: ApiFetchOpts = {}) {
  return apiFetch(path, { ...init, _silentOffline: true });
}
