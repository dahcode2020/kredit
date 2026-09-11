"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale, t } from "@/lib/i18n";
import { adminStats, mockAdminApps } from "@/lib/mockAdmin";
import { formatDate } from "@/lib/formatters";
import { Users, FolderKanban, Clock, Check, X, Wallet, RefreshCw, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const tr = (k: string, vars?: Record<string, any>) => t(locale, `admin:${k}`, vars);
  const s = adminStats;
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    setToday(formatDate(new Date(), locale));
  }, [locale]);
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div><h1 className="text-[22px] font-extrabold text-ink">{tr("dashboard.title")}</h1><p className="text-sm text-slate-500">{tr("dashboard.subtitle")}</p></div>
          <span className="px-3 py-1 rounded-full bg-white border text-xs font-bold">BE • EUR • {today || "—"}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            // Une carte = une clé de stats + une clé i18n dérivée (`dashboard.stat.<clé>`), plus un libellé
            // français collé à la donnée: la source des `adminStats` (lib/mockAdmin.ts) garde ses identifiants,
            // seule la copie passe par les dictionnaires.
            {k:"clients", v:s.clients, icon:Users, color:"bg-white"},
            {k:"demandes", v:s.demandes, icon:FolderKanban, color:"bg-white"},
            {k:"enAttente", v:s.enAttente, icon:Clock, color:"bg-amber-50 border-amber-200"},
            {k:"aExaminer", v:s.aExaminer, icon:AlertTriangle, color:"bg-red-50 border-red-200 text-red-700"},
            {k:"approuvees", v:s.approuvees, icon:Check, color:"bg-emerald-50 border-emerald-200"},
            {k:"refusees", v:s.refusees, icon:X, color:"bg-white"},
            {k:"actifs", v:s.actifs, icon:Wallet, color:"bg-white"},
            {k:"remboursements", v:`${(s.remboursements/1000000).toFixed(1)}M€`, icon:RefreshCw, color:"bg-white"},
            {k:"investissements", v:s.investissements, icon:TrendingUp, color:"bg-white"},
            {k:"alertes", v:s.alertes, icon:AlertTriangle, color:"bg-red-50 border-red-200 text-red-700"},
          ].map(c=>(
            <div key={c.k} className={`rounded-2xl border p-4 ${c.color}`}>
              <div className="flex items-center gap-2 text-xs tracking-widest uppercase font-bold text-slate-500"><c.icon className="w-4 h-4"/>{tr(`dashboard.stat.${c.k}`)}</div>
              <div className="text-xl font-extrabold text-ink mt-1">{c.v}</div>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5"/>
          <div className="text-sm"><div className="font-bold text-amber-900">{tr("dashboard.alerts", { count: 3 })}</div><div className="text-amber-800">{tr("dashboard.alertsDetail")}</div></div>
          <Link href={`/${locale}/admin/audit`} className="ml-auto h-8 px-3 rounded-full bg-ink text-white text-xs font-bold flex items-center gap-1">{tr("dashboard.seeAudit")} <ArrowRight className="w-3 h-3"/></Link>
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b flex justify-between"><h3 className="font-bold">{tr("dashboard.queue")}</h3><Link href={`/${locale}/admin/credit-applications`} className="text-xs font-bold text-primary">Tout voir →</Link></div>
          <div className="divide-y">
            {mockAdminApps.slice(0,3).map(a=>(
              <Link key={a.id} href={`/${locale}/admin/credit-applications/${a.id}`} className="p-4 flex flex-wrap justify-between gap-3 hover:bg-surface/50 block">
                <div><div className="flex gap-2 flex-wrap"><span className="font-mono text-xs font-bold bg-ink text-white px-2 py-1 rounded">{a.id}</span><span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{a.status}</span><span className="text-xs text-slate-500">{a.product} • {a.country}</span></div><div className="text-sm mt-1"><strong>{a.customer}</strong> • {a.amount}€ {a.term}m • Score {a.grade} ({a.score}) • Dette {a.debt} • {a.kyc} • Docs {a.docs}</div></div>
                <span className="self-center h-8 px-3 rounded-full bg-ink text-white text-xs font-bold flex items-center gap-1">{tr("dashboard.review")} <ArrowRight className="w-3 h-3"/></span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
