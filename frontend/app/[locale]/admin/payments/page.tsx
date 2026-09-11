"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { mockPayments } from "@/lib/mock";
import { formatEUR2 } from "@/lib/utils";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const eur=(v:number)=> formatEUR2(v,"fr-BE");
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4">
        <h1 className="text-[22px] font-extrabold text-ink">Paiements</h1>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-widest uppercase text-slate-500 border-b bg-surface/50"><tr><th className="text-left p-3">PSP</th><th>Montant</th><th>Statut</th><th>Date</th><th>Mandat</th></tr></thead>
              <tbody className="divide-y">
                {mockPayments.map(p=>(
                  <tr key={p.id}><td className="p-3 font-mono text-xs">{p.psp}</td><td className="p-3">{eur(p.amount)}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${p.status==='CONFIRMED'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{p.status}</span></td><td className="p-3 text-xs">{p.date}</td><td className="p-3 text-xs">MND-9c1e</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 text-xs text-slate-500">Réconciliation PSP Mollie • webhooks idempotents • mandats SEPA</div>
      </div>
    </AdminShell>
  );
}
