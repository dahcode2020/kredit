"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { mockInvestments } from "@/lib/mock";
import { formatEUR2 } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, Shield, AlertTriangle } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const eur=(v:number)=> formatEUR2(v,"fr-BE");
  return (
    <CustomerShell locale={locale}>
      <div className="space-y-6">
        <div><h1 className="text-[22px] font-extrabold text-ink">Investissements</h1><p className="text-sm text-slate-500">Risque 1-7 • Quiz MiFID • Perte en capital possible</p></div>
        <div className="bg-white rounded-2xl border p-5">
          <div className="flex justify-between"><div><div className="text-xs tracking-widest uppercase font-bold text-slate-500">Portefeuille</div><div className="text-2xl font-extrabold">{eur(8000)}</div></div><div className="text-right text-emerald-600 font-bold">+3.2% YTD</div></div>
          <div className="mt-4 space-y-2">
            {mockInvestments.map(inv=>(
              <Link key={inv.id} href={`/${locale}/investments/${inv.id}`} className="flex justify-between p-3 rounded-xl bg-surface border hover:bg-white">
                <div><div className="text-sm font-bold">{inv.name} <span className="text-xs bg-amber-50 text-amber-700 border px-1.5 py-0.5 rounded-full">Risque {inv.risk}/7</span></div><div className="text-xs text-slate-500">{inv.type}</div></div>
                <div className="text-right"><div className="text-sm font-bold">{eur(inv.amount)}</div><div className="text-xs text-emerald-600">{inv.perf}</div></div>
              </Link>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-bold flex items-center gap-2"><Shield className="w-4 h-4"/> Catalogue</h3>
          <div className="grid md:grid-cols-3 gap-3 mt-3">
            {[
              {name:"BE Green Bond 2031", risk:3, desc:"Article 8 • 2.1%"},
              {name:"EU Equity Core", risk:5, desc:"Actions • 5.4%"},
              {name:"Cash Euro", risk:1, desc:"Monétaire • 1.2%"},
            ].map(p=>(
              <div key={p.name} className="rounded-2xl border p-4 bg-surface">
                <div className="font-bold text-sm">{p.name}</div><div className="text-xs text-slate-500">Risque {p.risk}/7 • {p.desc}</div>
                <Link href={`/${locale}/investments/INV-001`} className="mt-3 inline-flex h-8 px-3 rounded-full bg-ink text-white text-xs font-bold">Voir</Link>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs"><AlertTriangle className="w-4 h-4 text-amber-600"/> Investir comporte un risque de perte. Quiz adéquation requis avant souscription.</div>
      </div>
    </CustomerShell>
  );
}
