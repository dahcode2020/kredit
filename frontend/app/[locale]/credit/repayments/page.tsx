"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { formatEUR2 } from "@/lib/utils";
import { Download, Calendar } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const eur = (v:number)=> formatEUR2(v, "fr-BE");
  const schedule = Array.from({length:60}, (_,i)=> ({m:i+1, payment:463.12, interest: i<20? 45: 12, principal: 463.12-(i<20?45:12), balance: 25000 - (i+1)*(463.12-30), status: i<2?'PAYÉ': i===2?'À VENIR':'À VENIR'}));
  return (
    <CustomerShell locale={locale}>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-[22px] font-extrabold text-ink">Échéanciers</h1><p className="text-sm text-slate-500">DISBURSED uniquement — méthode française</p></div><button className="h-11 px-5 rounded-full border font-bold flex items-center gap-2"><Download className="w-4 h-4"/> PDF complet</button></div>
        <div className="bg-white rounded-2xl border p-5 flex flex-wrap justify-between gap-4">
          <div><div className="text-xs tracking-widest uppercase font-bold text-slate-500">Prochaine échéance</div><div className="text-xl font-extrabold">01/10/2026 • {eur(463.12)}</div><div className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3"/> SEPA • IBAN BE12 **** 1234</div></div>
          <div className="text-right"><div className="text-xs tracking-widest uppercase font-bold text-slate-500">Progression</div><div className="w-40 h-2 bg-slate-100 rounded-full overflow-hidden mt-2"><div className="h-full w-[30%] bg-primary"/></div><div className="text-xs text-slate-500">18/60 payées</div></div>
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b text-xs tracking-widest uppercase text-slate-500"><tr><th className="text-left p-3">#</th><th>Échéance</th><th>Intérêts</th><th>Capital</th><th>Restant</th><th>Statut</th></tr></thead>
              <tbody className="divide-y">
                {schedule.slice(0,12).map(r=>(
                  <tr key={r.m} className="hover:bg-surface/50"><td className="p-3">{r.m}</td><td>{eur(r.payment)}</td><td>{eur(r.interest)}</td><td>{eur(r.principal)}</td><td>{eur(r.balance)}</td><td><span className={`px-2 py-1 rounded-full text-xs font-bold ${r.status==='PAYÉ'?'bg-emerald-50 text-emerald-700':'bg-slate-50'}`}>{r.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
