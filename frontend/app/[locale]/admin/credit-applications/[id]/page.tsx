"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { mockAdminApps } from "@/lib/mockAdmin";
import { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, FileText, Clock, Check, X, Eye } from "lucide-react";
import { formatEUR2 } from "@/lib/utils";
import { formatDateTime, localeToIntl } from "@/lib/formatters";
export default function Page({ params }: { params:{locale:string, id:string}}) {
  const locale = params.locale as Locale;
  const app = mockAdminApps.find(a=>a.id===params.id) || mockAdminApps[0];
  const [reason, setReason] = useState("");
  const [exception, setException] = useState("");
  const [showEx, setShowEx] = useState(false);
  const [decided, setDecided] = useState<string | null>(null);
  const [decidedAt, setDecidedAt] = useState<string>("");
  useEffect(() => {
    if (decided) setDecidedAt(formatDateTime(new Date(), locale));
  }, [decided]);
  const eur = (v: number) => formatEUR2(v, localeToIntl[locale]);
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="max-w-[1100px] space-y-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div><div className="flex gap-2 items-center"><span className="font-mono text-xs font-bold bg-ink text-white px-2 py-1 rounded">{app.id}</span><span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border text-xs font-bold">{app.status}</span><span className="text-xs text-slate-500">{app.product} • {app.country} • {eur(app.amount)} {app.term}m</span></div><h1 className="text-[18px] font-extrabold mt-1">{app.customer}</h1></div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border text-xs font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> MFA ✓</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border p-5 grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-bold text-sm">Identité</h3><div className="text-sm mt-1">Alex Martin, 32a, BE, CDI, 3 200€/m</div><div className="text-xs text-slate-500">NISS ***123 • Rue de la Loi 100</div>
                <h3 className="font-bold text-sm mt-4">KYC</h3><div className="text-sm">itsme® <span className="text-emerald-600 font-bold">VERIFIED</span> 08/09 • PEP clean • liveness 0.98</div>
                <h3 className="font-bold text-sm mt-4">Documents</h3>
                <div className="mt-1 space-y-1 text-sm">
                  <div className="flex justify-between p-2 rounded-xl bg-surface border"><span>ID</span><span className="text-emerald-600 font-bold">VERIFIED</span></div>
                  <div className="flex justify-between p-2 rounded-xl bg-surface border"><span>INCOME_3M</span><span className="text-emerald-600 font-bold">VERIFIED</span></div>
                  <div className="flex justify-between p-2 rounded-xl bg-amber-50 border border-amber-200"><span>PROOF_ADDRESS</span><span className="text-amber-700 font-bold">PENDING</span></div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-sm">Situation financière</h3>
                <div className="text-sm mt-1 space-y-1"><div>Revenus 3 200€ • Charges 900€ • Existants 250€</div><div>Capacité <strong>1 711€</strong> • Dette <strong className="text-amber-600">38.4%</strong> (plafond 33%)</div><div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-[68%] bg-amber-500"/></div></div>
                <h3 className="font-bold text-sm mt-4">Simulation</h3>
                <div className="text-sm mt-1">Mensualité <strong>338€</strong> • TAEG 4.21% • Total 16 414€ • <span className="text-xs">RateRule {app.product}_BE 10001-25000</span></div>
                <div className="text-xs text-slate-500">Échéancier 48 lignes French • frais 150€</div>
                <h3 className="font-bold text-sm mt-4">Score</h3>
                <div className="text-sm">62 <span className="px-2 py-0.5 rounded-full bg-ink text-white text-xs font-bold">C</span> — Moyen • breakdown debt15 stability20 emploi12 purpose8 term7</div>
                <div className="text-xs text-slate-500">Recommandation <strong className="text-amber-600">REVIEW_RECOMMENDATION</strong></div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border p-5">
                <h3 className="font-bold text-sm text-emerald-700">Règles respectées ✓</h3>
                <ul className="text-sm mt-2 space-y-1">
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500"/> min_age 32≥18</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500"/> max_amount 15k≤50k</li>
                  <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500"/> min_income 3200≥900</li>
                </ul>
              </div>
              <div className="bg-white rounded-2xl border p-5 border-amber-200">
                <h3 className="font-bold text-sm text-amber-700">Règles non respectées ⚠</h3>
                <ul className="text-sm mt-2 space-y-1">
                  <li className="flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-500"/> max_debt_ratio 38.4% &gt; 33% (soft) — valeur 0.384 seuil 0.33</li>
                  <li className="flex gap-2"><Eye className="w-4 h-4 text-slate-400"/> max_age ok</li>
                </ul>
                <p className="text-[11px] text-amber-700 mt-2">Affichées clairement si APPROVED_WITH_EXCEPTION</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-bold flex items-center gap-2"><Clock className="w-4 h-4"/> Historique — credit_application_status_history</h3>
              <ol className="mt-3 space-y-2 text-sm">
                <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2"/> DRAFT → SUBMITTED (CUSTOMER 08/09 14:22)</li>
                <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2"/> SUBMITTED → KYC_PENDING (SYSTEM)</li>
                <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2"/> KYC_PENDING → DOCUMENTS_PENDING (SYSTEM)</li>
                <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2"/> DOCUMENTS_PENDING → UNDER_AUTOMATED_REVIEW (SYSTEM)</li>
                <li className="flex gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 animate-pulse"/> UNDER_AUTOMATED_REVIEW → UNDER_ADMIN_REVIEW (SYSTEM, reco REVIEW)</li>
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-bold">Décision</h3>
              {decided ? (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm">
                  <div className="font-bold text-emerald-800">Décision: {decided}</div>
                  <div className="text-xs text-slate-600">Enregistré: admin@kredit.be • {decidedAt || "—"} • Règles: max_debt_ratio 38.4%→33% • Motif: {exception||reason||'—'} • hash a3f9…</div>
                  <div className="text-xs text-slate-500">audit_logs + history + event application.decided</div>
                </div>
              ) : (
                <>
                  <div className="mt-3 space-y-2">
                    <button onClick={()=>{ if(!confirm('Demander doc?')) return; setDecided('MORE_INFO_REQUESTED'); }} className="w-full h-10 rounded-full border text-sm font-bold">Demander document</button>
                    <button onClick={()=>setDecided('UNDER_ADMIN_REVIEW')} className="w-full h-10 rounded-full border text-sm font-bold">Mettre en revue (note)</button>
                    <button onClick={()=>setDecided('APPROVED')} className="w-full h-10 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-1"><Check className="w-4 h-4"/> Approuver</button>
                    <button onClick={()=>setShowEx(!showEx)} className="w-full h-10 rounded-full bg-amber-500 text-white text-sm font-bold">Approuver avec exception</button>
                    {showEx && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                        <div className="text-xs font-bold text-amber-800">Règles non satisfaites: max_debt_ratio 38.4% &gt; 33% (valeur 0.384 seuil 0.33)</div>
                        <textarea value={exception} onChange={e=>setException(e.target.value)} placeholder="Motif obligatoire 20-2000 chars (ex: Client historique 10 ans, garanties...)" rows={3} className="w-full rounded-xl border px-3 py-2 text-sm"/>
                        <label className="flex gap-2 text-xs"><input type="checkbox" required/> J'ai vérifié les règles ci-dessus</label>
                        <button onClick={()=>{ if(exception.trim().length<20) return alert('Motif 20-2000 requis'); if(app.amount>50000) alert('SUPER_ADMIN requis >50k — 403 si ADMIN'); setDecided('APPROVED_WITH_EXCEPTION'); }} className="w-full h-9 rounded-full bg-amber-600 text-white text-sm font-bold">Confirmer exception</button>
                        <p className="text-[11px] text-amber-700">Enregistre admin, date/heure, règles, valeurs, motif, décision → history.metadata + audit hash.</p>
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motif si refus / demande doc" rows={2} className="w-full rounded-xl border px-3 py-2 text-sm"/>
                      <button onClick={()=>{ if(!reason.trim()) return alert('Motif obligatoire'); setDecided('REJECTED'); }} className="w-full mt-2 h-10 rounded-full bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-1"><X className="w-4 h-4"/> Refuser</button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Toutes actions → ApplicationWorkflowService + audit. Bypass impossible.</p>
                </>
              )}
            </div>
            <div className="bg-white rounded-2xl border p-5">
              <h3 className="font-bold text-sm">Notes internes</h3>
              <textarea placeholder="Note privée (audit)" rows={3} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"/>
              <button className="mt-2 h-9 px-4 rounded-full border text-xs font-bold">Ajouter note</button>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
