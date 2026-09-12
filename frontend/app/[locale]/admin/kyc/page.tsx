"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDateTime } from "@/lib/formatters";
import { useState } from "react";
import { ShieldCheck, Check, X, Clock, Eye, AlertTriangle } from "lucide-react";

const mockKyc = [
  { id:'CUST-101', name:'Alex Martin • 32a', niss:'***123', status:'IN_REVIEW', phone:'+32470123456 ✓', email:'alex@kredit.be ✓', docs:'ID VERIFIED, FACTURE VERIFIED', risk:'LOW', submitted:'08/09 14:22' },
  { id:'CUST-103', name:'Tom Vandevelde • 26a', niss:'***456', status:'IN_REVIEW', phone:'+32470123457 ✓', email:'tom@kredit.be ✓', docs:'ID PENDING, FACTURE MANQUANT', risk:'MEDIUM', submitted:'09/09 09:11' },
  { id:'CUST-102', name:'Nadia El Amrani • 41a', niss:'***789', status:'VERIFIED', phone:'+32470123458 ✓', email:'nadia@kredit.be ✓', docs:'ID VERIFIED, FACTURE VERIFIED', risk:'LOW', verifiedBy:'admin@kredit.be', verifiedAt:'08/09 16:00' },
];

export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const { t } = useTranslation("admin");
  const [list, setList] = useState(mockKyc);
  const [reason, setReason] = useState("");

  const act = (id: string, decision: 'VERIFIED'|'REJECTED') => {
    if (decision==='REJECTED' && reason.trim().length < 10) return alert(t("kyc.reasonRequired"));
    setList(prev => prev.map(k => k.id===id ? { ...k, status: decision, verifiedBy:'admin@kredit.be', verifiedAt: formatDateTime(new Date(), locale) } as any : k));
    alert(t("kyc.decisionAlert", { decision, id, detail: decision === 'VERIFIED' ? t("kyc.decisionVerified") : t("kyc.decisionRejected", { reason }) }));
  };

  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4 max-w-[1100px]">
        <div className="flex flex-wrap justify-between gap-4">
          <div><h1 className="text-[22px] font-extrabold text-ink">{t("kyc.title")}</h1><p className="text-sm text-slate-500">{t("kyc.subtitle")}</p></div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border text-xs font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> {t("kyc.provider")}</span>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          {t("kyc.mvpNotice")}
        </div>

        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-widest uppercase text-slate-500 border-b bg-surface/50">
                <tr><th className="text-left p-3">{t("kyc.colClient")}</th><th>NISS</th><th>{t("kyc.colVerified")}</th><th>{t("kyc.colDocs")}</th><th>{t("kyc.colRisk")}</th><th>{t("kyc.colStatus")}</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {list.map(k=>(
                  <tr key={k.id} className="hover:bg-surface/50">
                    <td className="p-3"><div className="font-bold">{k.name}</div><div className="text-xs text-slate-500">{k.id} • {t("kyc.submitted")} {k.submitted}</div></td>
                    <td className="p-3 font-mono text-xs">{k.niss}</td>
                    <td className="p-3 text-xs">{k.phone}<br/>{k.email}</td>
                    <td className="p-3 text-xs">{k.docs}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${k.risk==='LOW'?'bg-emerald-50 text-emerald-700': k.risk==='MEDIUM'?'bg-amber-50 text-amber-700':'bg-red-50 text-red-700'}`}>{t(`risk.${k.risk}`)}</span></td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold border ${k.status==='VERIFIED'?'bg-emerald-50 text-emerald-700 border-emerald-200': k.status==='IN_REVIEW'?'bg-amber-50 text-amber-700 border-amber-200':'bg-red-50 text-red-700 border-red-200'}`}>{k.status}</span>{k.verifiedBy && <div className="text-[11px] text-slate-500">{k.verifiedBy} {k.verifiedAt}</div>}</td>
                    <td className="p-3 flex gap-1">
                      {k.status==='IN_REVIEW' ? <>
                        <button onClick={()=>act(k.id,'VERIFIED')} className="h-8 px-3 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"><Check className="w-3 h-3"/> {t("kyc.actionVerify")}</button>
                        <button onClick={()=>act(k.id,'REJECTED')} className="h-8 px-3 rounded-full bg-white border border-red-200 text-red-600 text-xs font-bold flex items-center gap-1"><X className="w-3 h-3"/> {t("kyc.actionReject")}</button>
                      </> : <span className="px-2 py-1 rounded-full bg-surface border text-xs flex items-center gap-1"><Eye className="w-3 h-3"/> Audit</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-bold text-sm flex items-center gap-2"><Clock className="w-4 h-4"/> {t("kyc.cycle")}</h3>
            <ol className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-slate-300 mt-2"/> NOT_STARTED → IN_REVIEW (customer upload)</li>
              <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2"/> IN_REVIEW → VERIFIED (ADMIN, MFA, motif) expires +12m</li>
              <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-red-500 mt-2"/> IN_REVIEW → REJECTED (motif 10+ chars) → IN_REVIEW (re-upload)</li>
            </ol>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <h3 className="font-bold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500"/> {t("kyc.reason")}</h3>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder={t("kyc.reasonPlaceholder")} rows={3} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"/>
            <p className="text-xs text-slate-500 mt-1">{t("kyc.reasonRequiredNote")}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-4 text-xs text-slate-500">
          Interfaces : <code>KycProvider</code> (`AdminManualProvider` MVP → `OnfidoProvider` futur), <code>AmlProvider</code>, <code>FraudDetectionProvider</code>. Aucun domaine ne dépend d’un fournisseur concret.
        </div>
      </div>
    </AdminShell>
  );
}
