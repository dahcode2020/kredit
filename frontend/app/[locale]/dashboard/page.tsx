"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { mockApps, mockPayments, mockInvestments, mockNotifs, mockDocs } from "@/lib/mock";
import { formatEUR2 } from "@/lib/utils";
import { ArrowRight, Clock, CreditCard, FileText, TrendingUp, AlertTriangle, Bell, Wallet } from "lucide-react";
import Link from "next/link";

export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const eur = (v:number)=> formatEUR2(v, locale);
  const active = mockApps.filter(a=>a.status==="DISBURSED");
  const next = mockPayments.find(p=>p.status==="PENDING");
  return (
    <CustomerShell locale={locale}>
      <div className="space-y-6">
        <div>
          <h1 className="text-[24px] font-extrabold text-ink">Résumé financier</h1>
          <p className="text-sm text-slate-500">Vue d&#39;ensemble — simulation ≠ offre, décision humaine</p>
        </div>

        {/* stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border p-5 shadow-soft">
            <div className="text-xs tracking-widest uppercase font-bold text-slate-500">Encours total</div>
            <div className="text-2xl font-extrabold text-ink mt-1">{eur(310000)}</div>
            <div className="text-xs text-slate-400">{active.length} crédits actifs • BE • EUR</div>
          </div>
          <div className="bg-white rounded-2xl border p-5 shadow-soft">
            <div className="text-xs tracking-widest uppercase font-bold text-slate-500">Prochaine échéance</div>
            <div className="text-2xl font-extrabold text-ink mt-1">{next? eur(next.amount) : "-"}</div>
            <div className="text-xs text-emerald-600 flex items-center gap-1"><Clock className="w-3 h-3"/>{next?.date} • SEPA {next?.psp}</div>
          </div>
          <div className="bg-white rounded-2xl border p-5 shadow-soft">
            <div className="text-xs tracking-widest uppercase font-bold text-slate-500">Capacité résiduelle</div>
            <div className="text-2xl font-extrabold text-ink mt-1">{eur(1780)}</div>
            <div className="text-xs text-slate-400">Après charges + mensualités</div>
          </div>
        </div>

        {/* shortcut */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {label:"Nouvelle simulation", href:"credit/simulator", icon: Wallet, color:"bg-ink text-white"},
            {label:"Reprendre DRAFT", href:"credit/applications", icon: FileText, color:"bg-white border"},
            {label:"Déposer doc", href:"credit/documents", icon: FileText, color:"bg-white border"},
            {label:"Voir échéancier", href:"credit/repayments", icon: CreditCard, color:"bg-white border"},
          ].map(c=>(
            <Link key={c.label} href={`/${locale}/${c.href}`} className={`rounded-2xl p-4 flex items-center gap-3 ${c.color}`}>
              <c.icon className="w-5 h-5"/><span className="text-sm font-bold">{c.label}</span>
            </Link>
          ))}
        </div>

        {/* demandes */}
        <div className="bg-white rounded-2xl border shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b flex justify-between items-center">
            <h2 className="font-bold text-ink">Demandes de crédit</h2>
            <Link href={`/${locale}/credit/applications`} className="text-xs font-bold tracking-widest uppercase text-primary flex items-center gap-1">Tout voir <ArrowRight className="w-3 h-3"/></Link>
          </div>
          <div className="divide-y">
            {mockApps.slice(0,3).map(a=>(
              <div key={a.id} className="px-5 py-4 flex flex-wrap justify-between gap-3 hover:bg-surface/50">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold bg-ink text-white px-2 py-1 rounded">{a.id}</span>
                    <span className="text-xs font-bold tracking-widest uppercase text-slate-500">{a.product}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${a.status==='DISBURSED'?'bg-emerald-50 text-emerald-700 border-emerald-200': a.status==='DRAFT'?'bg-slate-50 text-slate-600 border-slate-200': a.status==='MORE_INFORMATION_REQUIRED'?'bg-amber-50 text-amber-700 border-amber-200':'bg-blue-50 text-blue-700 border-blue-200'}`}>{a.status}</span>
                  </div>
                  <div className="text-sm text-ink mt-1"><strong>{eur(a.amount)}</strong> • {a.term}m • {eur(a.monthly)}/m • {a.taeg}%</div>
                </div>
                <Link href={`/${locale}/credit/applications/${a.id}`} className="self-center h-9 px-4 rounded-full border text-xs font-bold flex items-center gap-1">Voir <ArrowRight className="w-3 h-3"/></Link>
              </div>
            ))}
          </div>
          {/* empty state example */}
          {mockApps.length===0 && <div className="p-10 text-center text-sm text-slate-500">Aucune demande — <Link href={`/${locale}/credit/simulator`} className="text-primary font-bold underline">Simuler</Link></div>}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-bold text-ink flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/> Investissements</h3>
            {mockInvestments.map(inv=>(
              <div key={inv.id} className="mt-3 flex justify-between p-3 rounded-xl bg-surface border">
                <div><div className="text-sm font-bold">{inv.name}</div><div className="text-xs text-slate-500">Risque {inv.risk}/7 • {inv.type}</div></div>
                <div className="text-right"><div className="text-sm font-bold">{eur(inv.amount)}</div><div className="text-xs text-emerald-600">{inv.perf}</div></div>
              </div>
            ))}
            <Link href={`/${locale}/investments`} className="mt-3 inline-flex text-xs font-bold text-primary">Portefeuille →</Link>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-bold text-ink flex items-center gap-2"><Bell className="w-4 h-4 text-primary"/> Notifications</h3>
            {mockNotifs.slice(0,3).map(n=>(
              <div key={n.id} className={`mt-3 p-3 rounded-xl border flex gap-3 ${n.read?'bg-white':'bg-amber-50 border-amber-200'}`}>
                <div className="w-8 h-8 rounded-full bg-ink text-white grid place-items-center text-xs">{n.channel[0]}</div>
                <div><div className="text-sm font-bold text-ink">{n.title}</div><div className="text-xs text-slate-600">{n.body}</div><div className="text-[11px] text-slate-400">{n.date}</div></div>
              </div>
            ))}
            <Link href={`/${locale}/notifications`} className="mt-3 inline-flex text-xs font-bold text-primary">Centre notifs →</Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-5 flex flex-wrap justify-between gap-4">
          <div>
            <h3 className="font-bold text-ink flex items-center gap-2"><FileText className="w-4 h-4"/> Documents</h3>
            <div className="text-xs text-slate-500">{mockDocs.filter(d=>d.status==='VERIFIED').length}/{mockDocs.length} vérifiés</div>
          </div>
          <Link href={`/${locale}/credit/documents`} className="h-9 px-4 rounded-full bg-ink text-white text-xs font-bold flex items-center gap-1">Gérer <ArrowRight className="w-3 h-3"/></Link>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5"/><span><strong>Simulation ≠ offre.</strong> Toute décision est humaine (ADMIN) et auditée.</span>
        </div>
      </div>
    </CustomerShell>
  );
}
