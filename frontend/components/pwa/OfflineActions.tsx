"use client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Bouton « réessayer » de la page de repli hors ligne. `label` n'a **aucun** défaut en dur dans la
 * signature : un défaut français rendu tel quel sur /{en,nl,de}/offline, c'est le même piège que
 * `formatEUR(v, "fr")` (cf. docs/hydration.md, règle 5) — et le compteur de copie ne le voyait pas,
 * faute de deux mots sur la ligne. D'où la règle dure `défauts de prop` dans `scripts/check-copy.mjs`.
 */
export function RetryButton({ label }: { label?: string }) {
  const { t } = useTranslation("common");
  return (
    <Button onClick={() => window.location.reload()} className="gap-2">
      <RefreshCw className="w-4 h-4" /> {label ?? t("pwa.retry")}
    </Button>
  );
}
