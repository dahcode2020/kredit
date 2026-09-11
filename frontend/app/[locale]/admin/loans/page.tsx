"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { Wallet } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4">
        <h1 className="text-[22px] font-extrabold text-ink">Prêts actifs (6 800)</h1>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-widest uppercase text-slate-500 border-b bg-surface/50"><tr><th className="text-left p-3">Prêt</th><th>Client</th><th>Montant</th><th>Échéance</th><th>Retard</th></tr></thead>
              <tbody className="divide-y">
                {[
                  {id:'KRD-0799', client:'Alex Martin', amount:'25 000€', next:'01/10 463€', late:'—'},
                  {id:'KRD-0801', client:'Nadia E.', amount:'15 000€', next:'05/10 338€', late:'2j'},
                ].map(r=>(
                  <tr key={r.id}><td className="p-3 font-mono text-xs font-bold">{r.id}</td><td className="p-3">{r.client}</td><td className="p-3">{r.amount}</td><td className="p-3">{r.next}</td><td className="p-3 text-amber-600">{r.late}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 flex items-center gap-2 text-xs"><Wallet className="w-4 h-4"/> DISBURSED → remboursement cron + PSP</div>
      </div>
    </AdminShell>
  );
}
