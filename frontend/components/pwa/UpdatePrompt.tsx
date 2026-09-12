"use client";
import { RefreshCw, X } from "lucide-react";
import { useSWUpdate } from "@/hooks/useSWUpdate";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";

const DISMISS_KEY = "kredit-update-dismissed";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export default function UpdatePrompt() {
  const { updateAvailable, applyUpdate, dismissUpdate } = useSWUpdate();
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!updateAvailable) {
      setVisible(false);
      return;
    }
    // Respect dismissal TTL — don't nag on every refresh
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY) || localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const ts = Number(raw);
        if (!isNaN(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          return; // dismissed recently, stay hidden
        } else {
          // expired, clear
          sessionStorage.removeItem(DISMISS_KEY);
          localStorage.removeItem(DISMISS_KEY);
        }
      }
    } catch {}
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [updateAvailable]);

  if (!visible || !updateAvailable) return null;

  const onDismiss = () => {
    setVisible(false);
    dismissUpdate();
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  return (
    <div role="alert" aria-live="assertive" className="fixed top-[76px] left-1/2 -translate-x-1/2 bg-ink text-white rounded-full shadow-card border border-white/10 px-4 py-2 flex items-center gap-3 z-50 max-w-[90vw]">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-sm font-semibold whitespace-nowrap">{t("pwa.updateAvailable")}</span>
      <Button size="md" className="!h-7 !px-3 text-xs gap-1.5 whitespace-nowrap" onClick={applyUpdate}><RefreshCw className="w-3.5 h-3.5"/> {t("pwa.updateApply")}</Button>
      <button onClick={onDismiss} aria-label={t("pwa.updateDismiss")} className="w-6 h-6 rounded-full bg-white/10 grid place-items-center hover:bg-white/20 shrink-0"><X className="w-3 h-3"/></button>
    </div>
  );
}
