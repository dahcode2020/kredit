"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { mockApps } from "@/lib/mock";
import { formatEUR2 } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { Search, Filter, ArrowRight, Loader, FileX } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const eur = (v:number)=> formatEUR2(v, "fr-BE");
  const filtered = filter==="ALL"? mockApps : mockApps.filter(a=>a.status===filter);
  const onFilter=(f:string)=>{ setLoading(true); setTimeout(()=>{setFilter(f); setLoading(false)},400); };
  return (
    <CustomerShell locale={locale}>
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between gap-4">
          <div><h1 className="text-[22px] font-extrabold text-ink">Mes demandes</h1><p className="text-sm text-slate-500">{filtered.length} dossier(s) • workflow 16 statuts</p></div>
          <Link href={`/${locale}/credit/simulator`} className="h-11 px-6 rounded-full bg-primary text-white font-bold flex items-center gap-2">Nouvelle demande</Link>
        </div>
        <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-surface border rounded-full px-3 h-10"><Search className="w-4 h-4 text-slate-400"/><input placeholder="Rechercher KRD-..." className="bg-transparent outline-none text-sm flex-1"/></div>
          <div className="flex gap-2 flex-wrap">
            {["ALL","DRAFT","SUBMITTED","UNDER_ADMIN_REVIEW","APPROVED_WITH_EXCEPTION","DISBURSED","REJECTED"].map(f=>(
              <button key={f} onClick={()=>onFilter(f)} className={`px-4 py-2 rounded-full text-xs font-bold border ${filter===f?'bg-ink text-white':'bg-white'}`}>{f}</button>
            ))}
          </div>
        </div>
        {loading && <div className="bg-white rounded-2xl border p-10 flex flex-col items-center gap-2"><Loader className="w-6 h-6 animate-spin text-primary"/><span className="text-sm text-slate-500">Chargement...</span></div>}
        {!loading && filtered.length===0 && (
          <div className="bg-white rounded-2xl border p-10 text-center">
            <FileX className="w-10 h-10 text-slate-300 mx-auto"/>
            <div className="font-bold mt-2">Aucune demande</div><div className="text-sm text-slate-500">Lancez une simulation 8 champs</div>
            <Link href={`/${locale}/credit/simulator`} className="mt-4 inline-flex h-10 px-6 rounded-full bg-ink text-white font-bold">Simuler</Link>
          </div>
        )}
        {!loading && filtered.length>0 && (
          <div className="grid gap-3">
            {filtered.map(a=>(
              <Link key={a.id} href={`/${locale}/credit/applications/${a.id}`} className="bg-white rounded-2xl border p-5 flex flex-wrap justify-between gap-3 hover:shadow-soft">
                <div>
                  <div className="flex gap-2 flex-wrap"><span className="font-mono text-xs font-bold bg-ink text-white px-2 py-1 rounded">{a.id}</span><span className={`px-2 py-1 rounded-full text-xs font-bold border ${a.status==='DISBURSED'?'bg-emerald-50 text-emerald-700': a.status==='DRAFT'?'bg-slate-50': 'bg-blue-50 text-blue-700'}`}>{a.status}</span></div>
                  <div className="text-sm mt-1"><strong>{eur(a.amount)}</strong> • {a.term}m • {eur(a.monthly)}/m</div>
                  <div className="text-xs text-slate-500">Score {a.score} • Dette {a.debt} • {a.created}</div>
                </div>
                <span className="self-center h-9 px-4 rounded-full border text-xs font-bold flex items-center gap-1">Voir <ArrowRight className="w-3 h-3"/></span>
              </Link>
            ))}
          </div>
        )}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs"><Filter className="w-4 h-4 text-amber-600"/> Filtre status + search + tri date/montant. Loading skeleton, empty, error (retry + requestId).</div>
      </div>
    </CustomerShell>
  );
}
