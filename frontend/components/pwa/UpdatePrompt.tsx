"use client";
import { RefreshCw, X } from "lucide-react";
import { useSWUpdate } from "@/hooks/useSWUpdate";
import { Button } from "@/components/ui/Button";
import { useState, useEffect } from "react";

export default function UpdatePrompt() {
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, [updateAvailable]);

  if (!visible) return null;

  return (
    <div role="alert" aria-live="assertive" className="fixed top-[76px] left-1/2 -translate-x-1/2 bg-ink text-white rounded-full shadow-card border border-white/10 px-4 py-2 flex items-center gap-3 z-50">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="text-sm font-semibold">Mise à jour disponible</span>
      <Button size="md" className="!h-7 !px-3 text-xs gap-1.5" onClick={applyUpdate}><RefreshCw className="w-3.5 h-3.5"/> Actualiser</Button>
      <button onClick={() => setVisible(false)} aria-label="Ignorer" className="w-6 h-6 rounded-full bg-white/10 grid place-items-center hover:bg-white/20"><X className="w-3 h-3"/></button>
    </div>
  );
}
