"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale, t } from "@/lib/i18n";
import { PRODUITS, PRODUCT_TYPES, tauxMiniProduit } from "@/lib/credit-engine";
import { formatMontantCompact, formatPercent } from "@/lib/formatters";
import Link from "next/link";
import { Wallet, Home, Briefcase, BarChart3, Calculator, ArrowRight, ShieldCheck } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  // Les trois cartes étaient trois lignes de français avec trois plages et trois taux
  // recopiés à la main. Elles lisaient une grille morte: produits, bornes et « dès x % » viennent de
  // `PRODUITS`, et les intitulés du dictionnaire (donc en quatre langues, comme le reste du site).

  return (
    <CustomerShell locale={locale}>
      <div className="space-y-6">
        <div><h1 className="text-[22px] font-extrabold text-ink">Crédit</h1><p className="text-sm text-slate-500">Produits BE • simulateur 8 champs • workflow 17 étapes</p></div>
        <div className="grid md:grid-cols-3 gap-4">
          {[Wallet, Home, Briefcase, BarChart3].map((Icon, index) => {
            const code = PRODUCT_TYPES[index];
            const p = PRODUITS[code];
            return (
            <div key={code} className="bg-white rounded-2xl border p-5 lift">
              <Icon className="w-8 h-8 text-primary"/>
              <div className="font-bold mt-2">{t(locale, `products.${code.toLowerCase()}`)}</div>
              <div className="text-sm text-slate-500">{formatMontantCompact(p.min, locale)} – {formatMontantCompact(p.max, locale)} • {p.minTerm}–{p.maxTerm} m</div>
              <div className="text-[11px] font-bold text-slate-400 mt-1">{t(locale, "products.from")} {formatPercent(tauxMiniProduit(code), locale, 2)} TAEG*</div>
              <Link href={`/${locale}/credit/simulator`} className="mt-3 inline-flex h-9 px-4 rounded-full bg-ink text-white text-xs font-bold items-center gap-1">{t(locale, "heroCard.cta")} <ArrowRight className="w-3 h-3"/></Link>
            </div>
          );})}
        </div>
        <div className="bg-ink text-white rounded-2xl p-6 flex flex-wrap justify-between gap-4">
          <div><div className="font-bold">Simulateur 8 champs</div><div className="text-sm text-white/70">Taux par bande BE, endettement, score, reco REVIEW/APPROVE</div></div>
          <Link href={`/${locale}/credit/simulator`} className="h-11 px-6 rounded-full bg-primary text-white font-bold flex items-center gap-2"><Calculator className="w-4 h-4"/> Lancer</Link>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Link href={`/${locale}/credit/applications`} className="bg-white rounded-2xl border p-5 flex justify-between items-center">
            <div><div className="font-bold">Mes demandes</div><div className="text-xs text-slate-500">Suivi + historique 16 statuts</div></div><ArrowRight className="w-4 h-4"/>
          </Link>
          <Link href={`/${locale}/credit/documents`} className="bg-white rounded-2xl border p-5 flex justify-between items-center">
            <div><div className="font-bold">Documents</div><div className="text-xs text-slate-500">S3 présigné + ClamAV</div></div><ShieldCheck className="w-5 h-5 text-emerald-500"/>
          </Link>
        </div>
      </div>
    </CustomerShell>
  );
}
