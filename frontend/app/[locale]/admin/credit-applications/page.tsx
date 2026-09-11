"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { mockAdminApps } from "@/lib/mockAdmin";
import Link from "next/link";
import { useState } from "react";
import { Search, Filter } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const [filter, setFilter] = useState("UNDER_ADMIN_REVIEW");
  const filtered = filter==="ALL"? mockAdminApps : mockAdminApps.filter(a=>a.status===filter);
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-[22px] font-extrabold text-ink">Demandes à examiner (12)</h1><p className="text-sm text-slate-500">Filtres status/produit/pays/montant/score • tri risque</p></div><span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border text-xs font-bold">{filtered.length} en attente</span></div>
        <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-surface border rounded-full px-3 h-10 flex-1 min-w-[200px]"><Search className="w-4 h-4 text-slate-400"/><input placeholder="KRD-..., client, NISS" className="bg-transparent outline-none text-sm flex-1"/></div>
          {["ALL","UNDER_ADMIN_REVIEW","UNDER_AUTOMATED_REVIEW","MORE_INFORMATION_REQUIRED","APPROVED_WITH_EXCEPTION"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-2 rounded-full text-xs font-bold border ${filter===f?'bg-ink text-white':'bg-white'}`}>{f}</button>
          ))}
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-widest uppercase text-slate-500 border-b bg-surface/50"><tr><th className="text-left p-3">Dossier</th><th>Client</th><th>Montant</th><th>Score</th><th>Dette</th><th>KYC/Docs</th><th></th></tr></thead>
              <tbody className="divide-y">
                {filtered.map(a=>(
                  <tr key={a.id} className="hover:bg-surface/50">
                    <td className="p-3 font-mono text-xs font-bold">{a.id}<div className="text-[11px] text-slate-500">{a.product}</div></td>
                    <td className="p-3 text-sm">{a.customer}</td>
                    <td className="p-3">{a.amount}€<div className="text-xs text-slate-500">{a.term}m</div></td>
                    <td className="p-3"><span className="px-2 py-1 rounded-full bg-ink text-white text-xs font-bold">{a.grade} {a.score}</span></td>
                    <td className="p-3 text-xs">{a.debt}</td>
                    <td className="p-3 text-xs">{a.kyc} • {a.docs}</td>
                    <td className="p-3"><Link href={`/${locale}/admin/credit-applications/${a.id}`} className="h-8 px-3 rounded-full bg-ink text-white text-xs font-bold flex items-center justify-center">Examiner</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
