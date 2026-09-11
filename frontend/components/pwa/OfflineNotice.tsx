"use client";
import { WifiOff, ShieldAlert, Info } from "lucide-react";
import { useConnectivity } from "@/hooks/useConnectivity";
import { CACHE_STRATEGIES } from "@/lib/pwa";

export function OfflineBanner() {
  const { isOffline, isSyncing } = useConnectivity();
  if (!isOffline && !isSyncing) return null;
  return (
    <div role="status" aria-live="polite" className={isOffline ? "bg-red-600 text-white" : "bg-amber-500 text-white"}>
      <div className="mx-auto max-w-[1280px] px-6 py-2 flex items-center gap-3 text-sm">
        {isOffline ? <WifiOff className="w-4 h-4 shrink-0"/> : <Info className="w-4 h-4 animate-pulse"/>}
        <span className="font-semibold">
          {isOffline ? "Hors ligne — Mode limité." : "Reconnexion en cours… Synchronisation."}
        </span>
        <span className="hidden md:inline opacity-90">
          {isOffline ? "Les données financières ne sont pas disponibles hors ligne par sécurité." : "Vos données seront resynchronisées automatiquement."}
        </span>
      </div>
    </div>
  );
}

export function ServerRequiredNotice({ strategy = "FINANCIAL_DATA", actionLabel = "Opération" }: { strategy?: keyof typeof CACHE_STRATEGIES; actionLabel?: string }) {
  const { isOffline } = useConnectivity();
  if (!isOffline) return null;
  const cfg = CACHE_STRATEGIES[strategy];
  const isFinancial = strategy === "FINANCIAL_DATA" || strategy === "AUTHENTICATED_CONTENT";
  if (!isFinancial) return null;
  return (
    <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
      <div>
        <div className="font-bold text-amber-800 text-sm">{actionLabel} nécessite une connexion</div>
        <p className="text-sm text-amber-700 mt-1 leading-6">
          {strategy === "FINANCIAL_DATA"
            ? "Par sécurité, les données financières ne sont jamais mises en cache. Veuillez vous reconnecter — l’opération sera transmise au serveur avec idempotence et audit."
            : "Cette page contient des données personnelles. Elle n’est pas disponible hors ligne. Reconnectez-vous pour continuer."}
        </p>
        <p className="text-[11px] text-amber-600 mt-2">Stratégie: {cfg.strategy} • {cfg.description}</p>
      </div>
    </div>
  );
}
