"use client";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export default function ConnectivityStatus({ className }: { className?: string }) {
  const { state } = useConnectivity();
  const { t } = useTranslation("common");

  // Pastille vue dans le header de TOUTES les pages: sa copie vient des dictionnaires (locale du
  // segment [locale], résolue par useLocale → identique serveur/premier rendu client).
  const cfg = {
    ONLINE: { icon: Wifi, label: t("pwa.online"), sub: t("pwa.onlineSub"), color: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    OFFLINE: { icon: WifiOff, label: t("pwa.offline"), sub: t("pwa.offlineSub"), color: "bg-red-500", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    SYNCING: { icon: RefreshCw, label: t("pwa.syncing"), sub: t("pwa.syncingSub"), color: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  }[state];

  const Icon = cfg.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t("pwa.stateAria", { state: cfg.label })}
      className={cn("inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-semibold", cfg.bg, cfg.text, cfg.border, className)}
    >
      <span className="relative flex">
        <span className={cn("w-2 h-2 rounded-full", cfg.color, state === "SYNCING" && "animate-pulse")} />
        {state === "ONLINE" && <span className={cn("absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-30", cfg.color)} />}
      </span>
      <Icon className={cn("w-3.5 h-3.5", state === "SYNCING" && "animate-spin")} />
      <span className="hidden sm:inline font-bold tracking-wide uppercase text-[11px]">{cfg.label}</span>
      <span className="sm:hidden font-bold">{cfg.label}</span>
      <span className="hidden lg:inline text-[11px] opacity-70">• {cfg.sub}</span>
    </div>
  );
}

// Compact variant for header
export function ConnectivityDot() {
  const { state } = useConnectivity();
  const { t } = useTranslation("common");
  const color = state === "ONLINE" ? "bg-emerald-500" : state === "OFFLINE" ? "bg-red-500" : "bg-amber-500";
  const title = state === "ONLINE" ? t("pwa.onlineDot") : state === "OFFLINE" ? t("pwa.offlineDot") : t("pwa.syncingDot");
  return (
    <span title={title} aria-label={title} className="inline-flex items-center gap-1.5">
      <span className={cn("w-2 h-2 rounded-full", color, state === "SYNCING" && "animate-pulse")} />
      <span className="text-[11px] font-bold tracking-widest uppercase hidden md:inline text-white/70">{state}</span>
    </span>
  );
}
