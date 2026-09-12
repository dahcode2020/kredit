"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale, t } from "@/lib/i18n";
import { mockAudit } from "@/lib/mockAdmin";
import { ShieldCheck, Download } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const tr = (k: string, vars?: Record<string, any>) => t(locale, `admin:${k}`, vars);
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4">
        <div className="flex justify-between"><div><h1 className="text-[22px] font-extrabold text-ink">{tr("audit.title")}</h1><p className="text-sm text-slate-500">{tr("audit.subtitle")}</p></div><button className="h-10 px-4 rounded-full border text-sm font-bold flex items-center gap-2"><Download className="w-4 h-4"/> Export WORM</button></div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-[11px] tracking-widest uppercase text-slate-500 border-b bg-surface/50"><tr><th className="text-left p-3">{tr("audit.colTime")}</th><th>{tr("audit.colActor")}</th><th>{tr("audit.colAction")}</th><th>{tr("audit.colEntity")}</th><th>{tr("audit.colDiff")}</th><th>Hash</th></tr></thead>
              <tbody className="divide-y">
                {mockAudit.map(a=>(
                  <tr key={a.id} className="hover:bg-surface/50">
                    <td className="p-3">{a.at}</td><td className="p-3 font-mono">{a.actor}</td><td className="p-3"><span className="px-2 py-1 rounded-full bg-ink text-white text-xs">{a.action}</span></td><td className="p-3 font-mono">{a.entity}</td><td className="p-3">{a.before} → {a.after}<div className="text-[11px] text-slate-500">{a.reason}</div></td><td className="p-3 font-mono text-[11px]">{a.hash} <span className="text-slate-400">prev:{a.prev}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 flex items-center gap-2 text-xs"><ShieldCheck className="w-4 h-4 text-emerald-500"/> {tr("audit.verification")}</div>
      </div>
    </AdminShell>
  );
}
