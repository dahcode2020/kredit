"use client";
import { Badge } from "@/components/ui/Button";
import { Check, X, AlertTriangle, FileSearch, Shield, Clock, Eye, FileText, ChevronDown } from "lucide-react";
import { useState } from "react";

const dossiers = [
  { id: "KRD-2026-0842", customer: "Alex Martin • BE • 32 ans", amount: 15000, term: 48, grade: "B", debt: "28%", reco: "APPROVE", kyc: "Vérifié", risk: "Faible" },
  { id: "KRD-2026-0843", customer: "Nadia El Amrani • BE • 41 ans", amount: 48000, term: 72, grade: "D", debt: "41%", reco: "CONDITIONAL", kyc: "Vérifié", risk: "Moyen" },
  { id: "KRD-2026-0841", customer: "Luc Peeters • BE • 26 ans", amount: 5000, term: 24, grade: "E", debt: "52%", reco: "REJECT", kyc: "En attente doc", risk: "Élevé" },
];

export default function AdminPage(){
  const [exception, setException] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <Badge>ADMIN • Décision humaine obligatoire</Badge>
            <h1 className="text-[28px] font-extrabold text-ink mt-2">File d’attente — PENDING_REVIEW</h1>
            <p className="text-sm text-slate-500">Le moteur recommande. Vous décidez. Toute dérogation est auditée.</p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-3 py-2 rounded-full bg-white border font-bold flex items-center gap-2"><FileSearch className="w-4 h-4"/> 12 à traiter</span>
            <span className="px-3 py-2 rounded-full bg-white border font-bold flex items-center gap-2"><Clock className="w-4 h-4"/> SLA &lt;24h</span>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-[20px] border shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-ink">Dossiers à décider</h2>
            <span className="text-xs text-slate-500">3 affichés • tri: risque ↓</span>
          </div>
          <div className="divide-y">
            {dossiers.map(d=>(
              <div key={d.id} className="px-6 py-5">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap"><span className="font-mono text-xs font-bold bg-ink text-white px-2 py-1 rounded">{d.id}</span><span className="text-sm font-semibold text-ink">{d.customer}</span><span className={`px-2 py-1 rounded-full text-xs font-bold border ${d.reco==='APPROVE'?'bg-emerald-50 text-emerald-700 border-emerald-200': d.reco==='REJECT'?'bg-red-50 text-red-700 border-red-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>Recommandé: {d.reco}</span></div>
                    <div className="text-sm text-slate-600 mt-1">{d.amount.toLocaleString('fr-BE')}€ • {d.term} mois • Grade {d.grade} • Endettement {d.debt} • KYC: {d.kyc} • Risque: {d.risk}</div>
                    <div className="text-xs text-slate-400 mt-1">Scoring configurable (BE: max 33% endettement) — dérogation possible avec motif</div>
                  </div>
                  <div className="flex items-center gap-2 self-start">
                    <button className="h-9 px-4 rounded-full border text-xs font-bold flex items-center gap-1"><Eye className="w-3.5 h-3.5"/> Dossier</button>
                    <button onClick={()=> alert(`Approuvé ${d.id} — en prod: POST /admin/applications/${d.id}/decision {decided: APPROVED} + audit`)} className="h-9 px-4 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5"/> Approuver</button>
                    <button onClick={()=> alert(`Rejet ${d.id}`)} className="h-9 px-4 rounded-full bg-white border border-red-200 text-red-600 text-xs font-bold flex items-center gap-1"><X className="w-3.5 h-3.5"/> Rejeter</button>
                  </div>
                </div>
                {/* Exception UI */}
                <details className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <summary className="cursor-pointer text-xs font-bold text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Décision exceptionnelle (dérogation plafond/règle) <ChevronDown className="w-3 h-3 ml-auto"/></summary>
                  <div className="mt-3 space-y-3">
                    <label className="flex gap-2 text-xs font-semibold text-ink"><input type="checkbox" checked={exception} onChange={e=>setException(e.target.checked)}/> Activer dérogation exceptionnelle</label>
                    {exception && (
                      <div>
                        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Motif détaillé obligatoire — sera hashé dans l'audit (ex: client historique 10 ans, garanties complémentaires)..." rows={3} className="w-full rounded-xl border px-3 py-2 text-sm"/>
                        <p className="text-[11px] text-amber-700 mt-1">Au-delà du seuil configuré (ex: &gt;50k€), validation SUPER_ADMIN requise. Audit immuable: actor, before/after, hash chaîné.</p>
                        <button onClick={()=> { if(!reason.trim()) return alert("Motif obligatoire"); alert(`Dérogation enregistrée avec motif: ${reason} — audit OK`);}} className="mt-2 h-9 px-4 rounded-full bg-amber-600 text-white text-xs font-bold">Confirmer dérogation</button>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-bold text-ink flex items-center gap-2"><Shield className="w-4 h-4 text-primary"/> Règles BE (configurables)</h3>
            <ul className="mt-3 text-sm space-y-1 text-slate-600">
              <li>• max_debt_ratio: 33% (soft, dérogation possible)</li>
              <li>• min_age: 18 (hard — bloquant)</li>
              <li>• max_amount_PERSONAL_BE: 50 000€</li>
              <li>• TAEG ranges par produit — versionnés</li>
            </ul>
            <p className="text-[11px] text-amber-600 mt-2">⚠️ Toute règle marquée needs_legal_validation affiche bannière jusqu'à validation juridique.</p>
          </div>
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-bold text-ink flex items-center gap-2"><FileText className="w-4 h-4 text-primary"/> Documents — S3 présigné</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between p-2 rounded-xl bg-surface border"><span>Carte identité — recto.pdf</span><span className="text-emerald-600 font-bold">✓ Scan OK</span></div>
              <div className="flex justify-between p-2 rounded-xl bg-surface border"><span>Preuve revenus — 3 mois.pdf</span><span className="text-amber-600 font-bold">⏳ En attente</span></div>
              <div className="flex justify-between p-2 rounded-xl bg-surface border"><span>Contrat travail.pdf</span><span className="text-slate-400">—</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
