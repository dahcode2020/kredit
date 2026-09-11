import Link from "next/link";
import { WifiOff, ShieldAlert, Home, Calculator, Lock } from "lucide-react";
import { Locale, locales } from "@/lib/i18n";
import { RetryButton } from "@/components/pwa/OfflineActions";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const copy: Record<string, { title: string; sub: string; avail: string[]; unavailable: string[] }> = {
  fr: {
    title: "Vous êtes hors ligne",
    sub: "Le mode hors ligne est limité — par sécurité vos données financières ne sont jamais mises en cache.",
    avail: ["Page d’accueil et présentation", "Simulateur (calcul local, sans envoi)", "Informations produits & FAQ"],
    unavailable: ["Création / suivi dossier crédit", "Paiements & échéanciers", "Portefeuille investissements", "Notifications personnelles & documents"],
  },
  en: {
    title: "You are offline",
    sub: "Offline is limited — financial data is never cached for security.",
    avail: ["Home & product info", "Simulator (local calc, no submit)", "Legal & help"],
    unavailable: ["Credit applications", "Payments & schedules", "Investments portfolio", "Personal notifications"],
  },
  nl: {
    title: "U bent offline",
    sub: "Offline is beperkt — financiële gegevens worden nooit gecached.",
    avail: ["Home & info", "Simulator (lokaal)", "Productinformatie"],
    unavailable: ["Kredietdossiers", "Betalingen", "Investeringen", "Meldingen"],
  },
  de: {
    title: "Sie sind offline",
    sub: "Offline ist eingeschränkt — Finanzdaten werden nie zwischengespeichert.",
    avail: ["Startseite & Infos", "Simulator (lokal)", "Produktinfos"],
    unavailable: ["Kreditanträge", "Zahlungen", "Investitionen", "Benachrichtigungen"],
  },
};

export default function OfflinePage({ params }: { params: { locale: string } }) {
  const locale = (params.locale as Locale) || "fr";
  const t = copy[locale] || copy.fr;
  return (
    <div className="min-h-[70vh] grid place-items-center px-6 py-12 bg-surface">
      <div className="w-full max-w-[720px]">
        <div className="bg-white rounded-[24px] shadow-card border p-8 md:p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 grid place-items-center mx-auto"><WifiOff className="w-7 h-7 text-amber-600"/></div>
          <h1 className="mt-4 text-2xl md:text-3xl font-extrabold text-ink">{t.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500 max-w-[580px] mx-auto">{t.sub}</p>

          <div className="mt-6 grid md:grid-cols-2 gap-4 text-left">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="font-bold text-emerald-800 text-sm flex items-center gap-2"><Home className="w-4 h-4"/> Disponible hors ligne</div>
              <ul className="mt-2 space-y-1.5 text-sm text-emerald-700 list-disc list-inside">
                {t.avail.map(x => <li key={x}>{x}</li>)}
              </ul>
              <p className="text-[11px] text-emerald-600 mt-2">Stratégies: <span className="font-semibold">STATIC_ASSETS</span> CacheFirst • <span className="font-semibold">PUBLIC_CONTENT</span> StaleWhileRevalidate</p>
            </div>
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
              <div className="font-bold text-red-800 text-sm flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> Nécessite connexion</div>
              <ul className="mt-2 space-y-1.5 text-sm text-red-700 list-disc list-inside">
                {t.unavailable.map(x => <li key={x}>{x}</li>)}
              </ul>
              <p className="text-[11px] text-red-600 mt-2">Stratégies: <span className="font-semibold">AUTHENTICATED_CONTENT</span> NetworkFirst • <span className="font-semibold">FINANCIAL_DATA</span> NetworkOnly</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <RetryButton />
            <Link href={`/${locale}#simulateur`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full border bg-white font-semibold text-sm hover:bg-slate-50"><Calculator className="w-4 h-4"/> Simulateur local</Link>
            <Link href={`/${locale}`} className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-ink text-white font-semibold text-sm"><Home className="w-4 h-4"/> Accueil</Link>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400"><Lock className="w-3 h-3"/> Données financières chiffrées, non stockées hors ligne. Idempotence & audit côté serveur.</div>
        </div>

        <div className="mt-6 rounded-2xl bg-ink text-white p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">Besoin d’aide ?</div>
            <div className="text-xs text-white/60">Contactez un humain — pas un bot — dès reconnexion.</div>
          </div>
          <Link href={`/${locale}#contact`} className="h-9 px-4 rounded-full bg-white text-ink font-bold text-sm grid place-items-center">Contact</Link>
        </div>
      </div>
    </div>
  );
}
