"use client";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/Button";

/**
 * Notifications push.
 *
 * Le support push est détecté APRÈS hydratation (voir usePushNotifications): rendre une
 * branche différente selon `typeof window` produisait un arbre client ≠ HTML serveur
 * (hydration mismatch). La condition d'origine était en plus fausse:
 * `!('Notification' in window) && !('PushManager' in window)` ne se déclenchait jamais
 * sur Safari/Android où une seule des deux API manque.
 */
export default function PushManager({ compact = false }: { compact?: boolean }) {
  const { permission, support, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();
  const { t } = useTranslation("common");
  const known = support !== "checking";

  if (!known) {
    // Placeholder identique au HTML serveur: aucun contenu « navigateur-dépendant » au premier rendu
    return compact ? (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 bg-white text-slate-400">
        <Bell className="w-3 h-3" /> <span className="sr-only">{t("pwa.pushDetecting")}</span>
      </span>
    ) : (
      <div className="rounded-2xl border p-4 bg-white">
        <div className="flex items-center gap-2 font-bold text-ink"><Bell className="w-4 h-4 text-primary" /> {t("pwa.pushTitle")}</div>
        <p className="text-sm text-slate-500 mt-1">{t("pwa.pushBody")}</p>
      </div>
    );
  }

  if (support === "unsupported") {
    return <div className="text-xs text-slate-400">{t("pwa.pushUnsupported")}</div>;
  }

  if (compact) {
    return (
      <button
        onClick={() => subscribed ? unsubscribe() : subscribe()}
        disabled={loading}
        aria-label={subscribed ? t("pwa.pushDisableAria") : t("pwa.pushEnableAria")}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${subscribed ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin"/> : subscribed ? <Bell className="w-3 h-3"/> : <BellOff className="w-3 h-3"/>}
        {subscribed ? t("pwa.pushOn") : t("pwa.pushEnableShort")}
        <span className="hidden sm:inline opacity-60">• {permission}</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <div className="flex items-center gap-2 font-bold text-ink"><Bell className="w-4 h-4 text-primary"/> {t("pwa.pushTitle")}</div>
      <p className="text-sm text-slate-500 mt-1">{t("pwa.pushBody")}</p>
      <div className="mt-3 flex items-center gap-3">
        {subscribed ? (
          <Button variant="outline-light" onClick={unsubscribe} disabled={loading} className="gap-2">{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <BellOff className="w-4 h-4"/>} {t("pwa.pushOff")}</Button>
        ) : (
          <Button onClick={subscribe} disabled={loading || permission === 'denied'} className="gap-2">{loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Bell className="w-4 h-4"/>} {t("pwa.pushEnable")}</Button>
        )}
        <span className="text-xs text-slate-400">{t("pwa.pushPermission")}: <span className="font-semibold">{permission}</span>{permission === 'denied' && ` — ${t("pwa.pushDeniedHint")}`}</span>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">{t("pwa.pushNote")}</p>
    </div>
  );
}
