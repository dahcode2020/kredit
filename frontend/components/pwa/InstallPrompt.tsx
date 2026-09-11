"use client";
import { useState, useEffect } from "react";
import { Download, X, Smartphone, Monitor } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Button } from "@/components/ui/Button";

export default function InstallPrompt() {
  const { isInstallable, isStandalone, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);
  const [deferredShow, setDeferredShow] = useState(false);

  useEffect(() => {
    if (isInstallable && !isStandalone && !dismissed) {
      const t = setTimeout(() => setDeferredShow(true), 3000);
      return () => clearTimeout(t);
    }
  }, [isInstallable, isStandalone, dismissed]);

  if (isStandalone || !isInstallable || dismissed || !deferredShow) return null;

  const onDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem('kredit-install-dismissed', String(Date.now())); } catch {}
  };

  return (
    <div role="dialog" aria-label="Installer l'application" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-[380px] bg-white rounded-2xl shadow-card border p-4 z-50 animate-slide-up">
      <button onClick={onDismiss} aria-label="Fermer" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-100 grid place-items-center hover:bg-slate-200"><X className="w-3.5 h-3.5" /></button>
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-ink grid place-items-center shrink-0"><Smartphone className="w-5 h-5 text-white" /></div>
        <div className="pr-6">
          <div className="font-bold text-ink text-sm">Installer KREDIT</div>
          <p className="text-xs leading-5 text-slate-500 mt-1">Ajoutez KREDIT à votre écran d’accueil pour un accès instantané, notifications et mode hors-ligne sécurisé.</p>
          <ul className="mt-2 flex gap-2 text-[11px] text-slate-500">
            <li className="inline-flex items-center gap-1"><Monitor className="w-3 h-3"/> PWA</li>
            <li>•</li>
            <li>Standalone</li>
            <li>•</li>
            <li>60 kB</li>
          </ul>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="md" className="flex-1 gap-2" onClick={promptInstall}><Download className="w-4 h-4"/>Installer</Button>
        <button onClick={onDismiss} className="px-4 h-9 rounded-full border text-sm font-semibold hover:bg-slate-50">Plus tard</button>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Données financières jamais mises en cache sans connexion sécurisée.</p>
    </div>
  );
}
