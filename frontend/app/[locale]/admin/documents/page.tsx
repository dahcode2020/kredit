"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { mockDocs } from "@/lib/mock";
import { ShieldCheck } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4">
        <h1 className="text-[22px] font-extrabold text-ink">Documents</h1>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="divide-y">
            {mockDocs.map(d=>(
              <div key={d.code} className="p-4 flex justify-between">
                <div><div className="font-bold text-sm">{d.label} <span className="font-mono text-xs text-slate-400">{d.code}</span></div><div className="text-xs text-slate-500">{d.size} • {d.date}</div></div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold border ${d.status==='VERIFIED'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 flex items-center gap-2 text-xs"><ShieldCheck className="w-4 h-4 text-emerald-500"/> ClamAV + OCR • S3 présigné • rétention 10y</div>
      </div>
    </AdminShell>
  );
}
