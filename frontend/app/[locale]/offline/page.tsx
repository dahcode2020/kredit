import Link from "next/link";
import { WifiOff, ShieldAlert, Home, Calculator, Lock } from "lucide-react";
import { Locale, locales, t, isSupportedLocale } from "@/lib/i18n";
import { RetryButton } from "@/components/pwa/OfflineActions";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Page de repli du service worker. Elle était livrée avec sa **propre** copie : un dictionnaire
 * `{fr,en,nl,de}` écrit à la main dans le fichier, plus huit chaînes françaises posées en dur à côté
 * (« Disponible hors ligne », « Simulateur local », « Accueil », « Besoin d'aide ? », « Contact ») et
 * un repli `copy.fr` qui affichait du français à une locale inconnue. Deux sources de vérité = une
 * traduction oubliée, et une page censée prévenir l'utilisateur de son état… dans une langue qu'il ne
 * parle pas. Tout vient maintenant des dictionnaires `common:pwa.*` (contrôlés par `npm run check:copy`).
 */
export default function OfflinePage({ params }: { params: { locale: string } }) {
  const locale: Locale = isSupportedLocale(params.locale) ? (params.locale as Locale) : "fr";
  const tr = (k: string) => t(locale, k);
  const available = [tr("pwa.offlineAvail1"), tr("pwa.offlineAvail2"), tr("pwa.offlineAvail3")];
  const unavailable = [
    tr("pwa.offlineUnavail1"),
    tr("pwa.offlineUnavail2"),
    tr("pwa.offlineUnavail3"),
    tr("pwa.offlineUnavail4"),
  ];

  return (
    <div className="min-h-[70vh] grid place-items-center px-6 py-12 bg-surface">
      <div className="w-full max-w-[720px]">
        <div className="bg-white rounded-[24px] shadow-card border p-8 md:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 grid place-items-center mx-auto"><WifiOff className="w-7 h-7 text-amber-600"/></div>
          <h1 className="mt-4 text-2xl md:text-3xl font-extrabold text-ink">{tr("pwa.offlinePageTitle")}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 max-w-[580px] mx-auto">{tr("pwa.offlinePageSub")}</p>

          <div className="mt-6 grid md:grid-cols-2 gap-4 text-left">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="font-bold text-emerald-800 text-sm flex items-center gap-2"><Home className="w-4 h-4"/>{tr("pwa.offlineAvailable")}</div>
              <ul className="mt-2 space-y-1.5 text-sm text-emerald-700 list-disc list-inside">
                {available.map(x => <li key={x}>{x}</li>)}
              </ul>
              <p className="text-[11px] text-emerald-600 mt-2">{tr("pwa.offlineStrategies")} <span className="font-semibold">STATIC_ASSETS</span> CacheFirst • <span className="font-semibold">PUBLIC_CONTENT</span> StaleWhileRevalidate</p>
            </div>
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <div className="font-bold text-red-800 text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4"/>{tr("pwa.offlineRequires")}</div>
              <ul className="mt-2 space-y-1.5 text-sm text-red-700 list-disc list-inside">
                {unavailable.map(x => <li key={x}>{x}</li>)}
              </ul>
              <p className="text-[11px] text-red-600 mt-2">{tr("pwa.offlineStrategies")} <span className="font-semibold">AUTHENTICATED_CONTENT</span> NetworkFirst • <span className="font-semibold">FINANCIAL_DATA</span> NetworkOnly</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <RetryButton />
            <Link href={`/${locale}#simulateur`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full border bg-white font-semibold text-sm hover:bg-slate-50"><Calculator className="w-4 h-4"/>{tr("pwa.offlineSimulator")}</Link>
            <Link href={`/${locale}`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-ink text-white font-semibold text-sm"><Home className="w-4 h-4"/>{tr("pwa.offlineHome")}</Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400"><Lock className="w-3 h-3"/>{tr("pwa.offlineSecurityNote")}</div>
        </div>

        <div className="mt-6 rounded-2xl bg-ink text-white p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">{tr("pwa.offlineHelpTitle")}</div>
            <div className="text-xs text-white/60">{tr("pwa.offlineHelpBody")}</div>
          </div>
          <Link href={`/${locale}#contact`} className="h-9 px-4 rounded-full bg-white text-ink font-bold text-sm grid place-items-center">{tr("pwa.offlineContact")}</Link>
        </div>
      </div>
    </div>
  );
}
