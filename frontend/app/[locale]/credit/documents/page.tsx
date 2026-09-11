"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { mockDocs } from "@/lib/mock";
import { Upload, Eye, Trash2, ShieldCheck, AlertTriangle, Loader, FileText } from "lucide-react";
import { useState } from "react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const [docs, setDocs] = useState(mockDocs);
  const [uploading, setUploading] = useState(false);
  const upload = ()=>{ setUploading(true); setTimeout(()=>{ setUploading(false); setDocs([...docs, {code:'NEW', label:'Nouveau doc', status:'PENDING', date:'2026-09-10', size:'1 MB'}]); },1200); };
  return (
    <CustomerShell locale={locale}>
      <div className="max-w-[800px] space-y-6">
        <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-[22px] font-extrabold text-ink">Documents</h1><p className="text-sm text-slate-500">S3 présigné 15m + ClamAV → VERIFIED. Rétention 10 ans BE.</p></div><span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Chiffré AES-256</span></div>
        <div className="bg-white rounded-2xl border-2 border-dashed p-8 text-center">
          <Upload className="w-10 h-10 text-slate-300 mx-auto"/>
          <div className="font-bold mt-2">Glissez vos documents</div><div className="text-sm text-slate-500">PDF/JPG/PNG ≤10 MB — ID, INCOME_3M, PROOF_ADDRESS requis</div>
          <button onClick={upload} disabled={uploading} className="mt-4 h-11 px-6 rounded-full bg-ink text-white font-bold flex items-center gap-2 mx-auto disabled:opacity-50">{uploading? <Loader className="w-4 h-4 animate-spin"/>: <Upload className="w-4 h-4"/>} {uploading?'Upload S3...':'Choisir fichiers'}</button>
          <p className="text-[11px] text-slate-400 mt-2">Upload → PUT S3 présigné → queue virus-scan → OCR → VERIFIED</p>
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b font-bold">Mes documents</div>
          <div className="divide-y">
            {docs.map(d=>(
              <div key={d.code+d.label} className="p-4 flex flex-wrap justify-between gap-3 hover:bg-surface/50">
                <div className="flex gap-3"><FileText className="w-8 h-8 text-slate-400"/><div><div className="text-sm font-bold">{d.label} <span className="font-mono text-xs text-slate-400">({d.code})</span></div><div className="text-xs text-slate-500">{d.size} • {d.date}</div></div></div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold border ${d.status==='VERIFIED'?'bg-emerald-50 text-emerald-700 border-emerald-200': d.status==='PENDING'?'bg-amber-50 text-amber-700 border-amber-200':'bg-red-50 text-red-700 border-red-200'}`}>{d.status}</span>
                  <button className="w-8 h-8 rounded-full border grid place-items-center"><Eye className="w-4 h-4"/></button>
                  <button className="w-8 h-8 rounded-full border grid place-items-center text-red-500"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            ))}
          </div>
          {docs.length===0 && <div className="p-10 text-center text-sm text-slate-500">Aucun document — déposez ID</div>}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs"><AlertTriangle className="w-4 h-4 text-amber-600"/> Si VIRUS_DETECTED → quarantaine + notif ADMIN. Signed URL 15m pour voir.</div>
      </div>
    </CustomerShell>
  );
}
