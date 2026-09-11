"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale, t } from "@/lib/i18n";
import { mockCustomers } from "@/lib/mockAdmin";
import Link from "next/link";
import { Search, ShieldCheck, AlertTriangle } from "lucide-react";
import { useState } from "react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const tr = (k: string, vars?: Record<string, any>) => t(locale, `admin:${k}`, vars);
  const [q, setQ] = useState("");
  const filtered = mockCustomers.filter(c=> c.name.toLowerCase().includes(q.toLowerCase()) || c.email.includes(q));
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-[22px] font-extrabold text-ink">{tr("customers.title")} (8 400)</h1><p className="text-sm text-slate-500">{tr("customers.search")}</p></div><span className="px-3 py-1 rounded-full bg-white border text-xs font-bold">BE • EUR</span></div>
        <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-surface border rounded-full px-3 h-10 flex-1 min-w-[200px]"><Search className="w-4 h-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher email, NISS, nom" className="bg-transparent outline-none text-sm flex-1"/></div>
          <select className="h-10 rounded-full border px-3 text-sm bg-white"><option>Tous KYC</option><option>VERIFIED</option><option>PENDING</option></select>
          <select className="h-10 rounded-full border px-3 text-sm bg-white"><option>{tr("customers.riskAll")}</option><option>{tr("customers.riskLow")}</option><option>{tr("customers.riskMedium")}</option><option>{tr("customers.riskHigh")}</option></select>
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-widest uppercase text-slate-500 border-b bg-surface/50"><tr><th className="text-left p-3">{tr("loans.colClient")}</th><th>KYC</th><th>{tr("customers.colRisk")}</th><th>{tr("customers.colFiles")}</th><th>{tr("customers.colCreated")}</th><th></th></tr></thead>
              <tbody className="divide-y">
                {filtered.map(c=>(
                  <tr key={c.id} className="hover:bg-surface/50">
                    <td className="p-3"><div className="font-bold">{c.name}</div><div className="text-xs text-slate-500">{c.email} • {c.country}</div></td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold border ${c.kyc==='VERIFIED'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>{c.kyc}</span></td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${c.risk==='Faible'?'bg-emerald-50 text-emerald-700': c.risk==='Moyen'?'bg-amber-50 text-amber-700':'bg-red-50 text-red-700'}`}>{c.risk}</span></td>
                    <td className="p-3">{c.dossiers}</td>
                    <td className="p-3 text-xs text-slate-500">{c.created}</td>
                    <td className="p-3"><Link href={`/${locale}/admin/customers/${c.id}`} className="h-8 px-3 rounded-full border text-xs font-bold flex items-center gap-1">Voir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length===0 && <div className="p-10 text-center text-sm text-slate-500">Aucun client — empty state</div>}
        </div>
        <div className="bg-white rounded-2xl border p-4 flex items-center gap-2 text-xs"><ShieldCheck className="w-4 h-4 text-emerald-500"/> {tr("customers.mfaNotice")}</div>
      </div>
    </AdminShell>
  );
}
