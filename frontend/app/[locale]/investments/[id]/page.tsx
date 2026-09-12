"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { formatEUR2 } from "@/lib/utils";
export default function Page({ params }: { params:{locale:string, id:string}}) {
  const locale = params.locale as Locale;
  return (
    <CustomerShell locale={locale}>
      <div className="max-w-[700px] space-y-6">
        <div><span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border text-xs font-bold">Risque 3/7</span><h1 className="text-[22px] font-extrabold mt-2">BE Green Bond 2031 — {params.id}</h1><p className="text-sm text-slate-500">Article 8 • Obligataire • 2.1% YTD • Prospectus & PRIIPs</p></div>
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-surface rounded-xl p-3"><div className="text-xs tracking-widest uppercase font-bold text-slate-500">Valeur</div><div className="font-extrabold">{formatEUR2(5000, locale)}</div></div>
            <div className="bg-surface rounded-xl p-3"><div className="text-xs tracking-widest uppercase font-bold text-slate-500">Perf</div><div className="font-extrabold text-emerald-600">+2.1%</div></div>
            <div className="bg-surface rounded-xl p-3"><div className="text-xs tracking-widest uppercase font-bold text-slate-500">Échéance</div><div className="font-bold">2031</div></div>
          </div>
          <div className="bg-surface rounded-xl p-4 text-sm leading-6">Obligation verte BE, risque modéré. Documentation PRIIPs disponible. Quiz MiFID: profil Équilibré (08/09/2026). Perte en capital possible.</div>
          <button className="w-full h-11 rounded-full bg-ink text-white font-bold">Souscrire (après quiz)</button>
        </div>
      </div>
    </CustomerShell>
  );
}
