"use client";
import { WifiOff, ShieldAlert, Info } from "lucide-react";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useTranslation } from "@/hooks/useTranslation";
import { CACHE_STRATEGIES } from "@/lib/pwa";

export function OfflineBanner() {
  const { isOffline, isSyncing } = useConnectivity();
  const { t } = useTranslation("common");
  if (!isOffline && !isSyncing) return null;
  return (
    <div role="status" aria-live="polite" className={isOffline ? "bg-red-600 text-white" : "bg-amber-500 text-white"}>
      <div className="mx-auto max-w-[1280px] px-6 py-2 flex items-center gap-3 text-sm">
        {isOffline ? <WifiOff className="w-4 h-4 shrink-0"/> : <Info className="w-4 h-4 animate-pulse"/>}
        <span className="font-semibold">
          {isOffline ? t("pwa.offlineBanner") : t("pwa.syncingBanner")}
        </span>
        <span className="hidden md:inline opacity-90">
          {isOffline ? t("pwa.offlineBannerData") : t("pwa.syncingBannerData")}
        </span>
      </div>
    </div>
  );
}

export function ServerRequiredNotice({ strategy = "FINANCIAL_DATA", actionLabel }: { strategy?: keyof typeof CACHE_STRATEGIES; actionLabel?: string }) {
  const { isOffline } = useConnectivity();
  const { t } = useTranslation("common");
  // Plus de défaut « "Opération" » en dur dans la signature: un paramètre par défaut français, c'est
  // exactement le piège qui a fait rendre du français à 3 marchés sur 4 (cf. formatEUR, docs/hydration.md).
  const action = actionLabel ?? t("pwa.operation");
  if (!isOffline) return null;
  const cfg = CACHE_STRATEGIES[strategy];
  const isFinancial = strategy === "FINANCIAL_DATA" || strategy === "AUTHENTICATED_CONTENT";
  if (!isFinancial) return null;
  return (
    <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
      <div>
        <div className="font-bold text-amber-800 text-sm">{t("pwa.serverRequired", { action })}</div>
        <p className="text-sm text-amber-700 mt-1 leading-6">
          {strategy === "FINANCIAL_DATA" ? t("pwa.serverRequiredFinancial") : t("pwa.serverRequiredPersonal")}
        </p>
        <p className="text-[11px] text-amber-600 mt-2">{t("pwa.strategyLabel")}: {cfg.strategy}</p>
      </div>
    </div>
  );
}
