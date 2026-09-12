"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { formatEUR2 } from "@/lib/utils";
import { mockApps, mockDocs } from "@/lib/mock";
import { Check, Clock, AlertTriangle, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";
export default function Page({ params }: { params:{locale:string, id:string}}) {
  const locale = params.locale as Locale;
  const app = mockApps.find(a=>a.id===params.id) || mockApps[0];
  const eur = (v:number)=> formatEUR2(v, locale);
  const steps = ["DRAFT","SUBMITTED","KYC_PENDING","DOCUMENTS_PENDING","UNDER_AUTOMATED_REVIEW","UNDER_ADMIN_REVIEW","APPROVED_WITH_EXCEPTION","CONTRACT_PENDING","CONTRACT_SIGNED","DISBURSEMENT_PENDING","DISBURSED","CLOSED"];
  const idx = steps.indexOf(app.status);
  return (
    <CustomerShell locale={locale}>
      <div className="space-y-6 max-w-[900px]">
        <div className="flex flex-wrap justify-between gap-4">
          <div><div className="flex gap-2 items-center"><span className="font-mono text-xs font-bold bg-ink text-white px-2 py-1 rounded">{app.id}</span><span className={`px-2 py-1 rounded-full text-xs font-bold border ${app.status==='APPROVED_WITH_EXCEPTION'?'bg-amber-50 text-amber-700 border-amber-200': app.status==='DISBURSED'?'bg-emerald-50 text-emerald-700':'bg-blue-50 text-blue-700'}`}>{app.status}</span></div><h1 className="text-[20px] font-extrabold text-ink mt-2">{eur(app.amount)} • {app.term}m • {eur(app.monthly)}/m</h1><p className="text-sm text-slate-500">{app.product} • reco {app.recommendation}</p></div>
          <div className="flex gap-2 self-start">
            {app.status==='DRAFT' && <Link href={`/${locale}/credit/simulator`} className="h-10 px-5 rounded-full bg-ink text-white text-sm font-bold flex items-center gap-1">Reprendre <ArrowRight className="w-4 h-4"/></Link>}
            {app.status==='CONTRACT_PENDING' && <button className="h-10 px-5 rounded-full bg-primary text-white text-sm font-bold">Signer contrat (QES)</button>}
            <Link href={`/${locale}/credit/documents`} className="h-10 px-5 rounded-full border text-sm font-bold flex items-center gap-1"><FileText className="w-4 h-4"/> Docs</Link>
          </div>
        </div>
        {app.status==='APPROVED_WITH_EXCEPTION' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5"/>
            <div><div className="font-bold text-amber-900">Approuvé avec exception</div><div className="text-sm text-amber-800">Motif ADMIN obligatoire: Client historique 10 ans, garanties hypothécaires complémentaires. Audit hash-chaîné + SUPER_ADMIN &gt;50k validé.</div></div>
          </div>
        )}
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-bold flex items-center gap-2"><Clock className="w-4 h-4"/> Timeline — credit_application_status_history</h3>
          <ol className="mt-4 relative border-l-2 border-slate-100 ml-2 space-y-4">
            {steps.map((s,i)=>(
              <li key={s} className={`ml-4 flex gap-3 ${i>idx?'opacity-40':''}`}>
                <span className={`w-3 h-3 rounded-full mt-1.5 -ml-[21px] border-2 ${i<=idx?'bg-primary border-primary':'bg-white border-slate-300'}`}/>
                <div>
                  <div className="text-sm font-bold">{s} {i===idx && <span className="ml-2 text-xs bg-ink text-white px-2 py-0.5 rounded-full">Actuel</span>}</div>
                  <div className="text-xs text-slate-500">2026-09-0{Math.min(9, i+1)} • {i<idx? <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500"/> Fait</span> : i===idx?'En cours':'En attente'}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-bold">Simulation snapshot</h3>
            <div className="text-sm mt-2 space-y-1"><div>Mensualité: <strong>{eur(app.monthly)}</strong></div><div>TAEG: {app.taeg}%</div><div>Dette: {app.debt}</div><div>Score: {app.score}</div></div>
            <p className="text-[11px] text-slate-400 mt-2">Snapshot figé à la soumission — taux BE bande.</p>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-bold">Documents</h3>
            {mockDocs.slice(0,3).map(d=>(
              <div key={d.code} className="mt-2 flex justify-between p-2 rounded-xl bg-surface border text-sm"><span>{d.label}</span><span className={`text-xs font-bold px-2 py-1 rounded-full ${d.status==='VERIFIED'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{d.status}</span></div>
            ))}
            <Link href={`/${locale}/credit/documents`} className="text-xs font-bold text-primary mt-2 inline-block">Gérer →</Link>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-bold">Échéancier (si DISBURSED)</h3>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-widest uppercase text-slate-500"><tr><th className="text-left py-2">#</th><th>Échéance</th><th>Intérêts</th><th>Capital</th><th>Restant</th><th>Statut</th></tr></thead>
              <tbody className="divide-y">
                {[1,2,3].map(m=>(
                  <tr key={m}><td>{m}</td><td>{eur(app.monthly)}</td><td>{eur(45)}</td><td>{eur(app.monthly-45)}</td><td>{eur(app.amount - m* (app.monthly-45))}</td><td><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs">PAYÉ</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
