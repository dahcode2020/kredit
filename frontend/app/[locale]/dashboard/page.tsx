"use client";
import { Badge } from "@/components/ui/Button";
import { Locale } from "@/lib/i18n";
import { FileText, Clock, ShieldCheck, CreditCard, TrendingUp, Upload, Bell, Eye, ArrowRight, AlertTriangle } from "lucide-react";
import { formatEUR2 } from "@/lib/utils";
const apps = [
  { id: "KRD-2026-0842", product: "Personnel • BE", amount: 15000, term: 48, status: "PENDING_REVIEW", scoring: "B — Recommandé APPROVE", monthly: 338.84, taeg: 0.0399 },
  { id: "KRD-2026-0831", product: "Hypothécaire • BE", amount: 285000, term: 240, status: "MORE_INFO_REQUESTED", scoring: "C — Docs manquants", monthly: 1612.11, taeg: 0.0325 },
  { id: "KRD-2026-0799", product: "Investissement • BE", amount: 10000, term: 60, status: "DECIDED_APPROVED", scoring: "A", monthly: 184.02, taeg: 0.041 },
];
const statusMap: Record<string, { label: string; color: string }> = {
  PENDING_REVIEW: { label: "En revue humaine", color: "bg-amber-100 text-amber-700 border-amber-200" },
  MORE_INFO_REQUESTED: { label: "Infos demandées", color: "bg-blue-100 text-blue-700 border-blue-200" },
  DECIDED_APPROVED: { label: "Approuvé", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export default function Dashboard({ params }: { params: { locale: string } }) {
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge>Customer • Espace client</Badge>
            <h1 className="text-[28px] font-extrabold text-ink mt-2">Bonjour, Alex — vos dossiers</h1>
            <p className="text-sm text-slate-500">Simulation ≠ offre • Décision humaine obligatoire • Audit complet</p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-2 rounded-full bg-white border text-xs font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500"/> KYC Vérifié</span>
            <span className="px-3 py-2 rounded-full bg-white border text-xs font-bold flex items-center gap-2"><Bell className="w-4 h-4"/> 3 notifs</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-2xl border p-5">
            <div className="text-xs tracking-widest uppercase font-bold text-slate-500">Encours total</div>
            <div className="text-2xl font-extrabold text-ink mt-1">{formatEUR2(310000, "fr-BE")}</div>
            <div className="text-xs text-slate-400">2 crédits actifs</div>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <div className="text-xs tracking-widest uppercase font-bold text-slate-500">Prochaine échéance</div>
            <div className="text-2xl font-extrabold text-ink mt-1">{formatEUR2(338.84, "fr-BE")}</div>
            <div className="text-xs text-emerald-600">12 sept. 2026 • SEPA</div>
          </div>
          <div className="bg-white rounded-2xl border p-5">
            <div className="text-xs tracking-widest uppercase font-bold text-slate-500">Score interne</div>
            <div className="text-2xl font-extrabold text-ink mt-1">Grade B</div>
            <div className="text-xs text-slate-400">Endettement 28% — sous plafond 33%</div>
          </div>
        </div>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div><strong className="text-amber-900">Action requise:</strong> votre dossier <span className="font-mono">KRD-2026-0831</span> attend une preuve de revenus. <button className="text-primary font-bold underline ml-1">Déposer maintenant <Upload className="inline w-3 h-3"/></button></div>
        </div>

        <div className="mt-6 bg-white rounded-[20px] border shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-ink flex items-center gap-2"><FileText className="w-4 h-4"/> Mes demandes</h2>
            <a href="/fr#simulateur" className="text-xs font-bold tracking-widest uppercase text-primary flex items-center gap-1">Nouvelle demande <ArrowRight className="w-3 h-3"/></a>
          </div>
          <div className="divide-y">
            {apps.map(a=>(
              <div key={a.id} className="px-6 py-5 flex flex-wrap items-center justify-between gap-4 hover:bg-surface/50">
                <div>
                  <div className="flex items-center gap-2"><span className="font-mono text-xs font-bold bg-ink text-white px-2 py-1 rounded">{a.id}</span><span className="text-xs font-bold tracking-widest uppercase text-slate-500">{a.product}</span><span className={`px-2.5 py-1 rounded-full border text-xs font-bold ${statusMap[a.status].color}`}>{statusMap[a.status].label}</span></div>
                  <div className="mt-1 text-sm text-ink"><strong>{formatEUR2(a.amount,"fr-BE")}</strong> • {a.term} mois • {formatEUR2(a.monthly,"fr-BE")}/mois • TAEG {(a.taeg*100).toFixed(2)}%</div>
                  <div className="text-xs text-slate-500">Scoring: {a.scoring} • Recommandation ≠ décision finale</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="h-9 px-4 rounded-full border text-xs font-bold flex items-center gap-1"><Eye className="w-3.5 h-3.5"/> Voir</button>
                  <button className="h-9 px-4 rounded-full bg-ink text-white text-xs font-bold flex items-center gap-1"><CreditCard className="w-3.5 h-3.5"/> Échéancier</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-bold text-ink flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/> Investissements (aperçu)</h3>
            <p className="text-xs text-slate-500 mt-1">Fonds Article 8 • Risque 3/7 • Perte en capital possible</p>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-sm"><span>BE Green Bond 2031</span><span className="font-bold">5 000€ • +2,1% YTD</span></div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-[64%] bg-emerald-500"/></div>
              <p className="text-[11px] text-slate-400">Quiz adéquation passé le 08/09/2026 — profil Équilibré. MiFID-like configurable.</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border p-6">
            <h3 className="font-bold text-ink flex items-center gap-2"><Clock className="w-4 h-4 text-primary"/> Timeline — KRD-2026-0842</h3>
            <ol className="mt-4 space-y-2 text-sm">
              <li className="flex gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2"/><span><strong>DRAFT</strong> créé 10/09 09:12 — idempotency OK</span></li>
              <li className="flex gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2"/><span><strong>SUBMITTED</strong> — KYC itsme® vérifié</span></li>
              <li className="flex gap-3"><span className="w-2 h-2 rounded-full bg-emerald-500 mt-2"/><span><strong>SCORING</strong> B — endettement 28%</span></li>
              <li className="flex gap-3"><span className="w-2 h-2 rounded-full bg-amber-500 mt-2 animate-pulse"/><span><strong>PENDING_REVIEW</strong> — en attente ADMIN (décision humaine)</span></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
