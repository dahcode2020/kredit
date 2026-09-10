"use client";
import { useMemo, useState } from "react";
import { formatEUR, formatEUR2 } from "@/lib/utils";
import { Button, Badge } from "@/components/ui/Button";
import { Info, ShieldCheck, Calculator, FileWarning, ArrowRight, Sparkles, AlertTriangle, CheckCircle, XCircle, Eye, FileText, TrendingUp } from "lucide-react";
import { Locale, t } from "@/lib/i18n";
import { simulateCredit, SimulateInput } from "@/lib/credit-engine";
const products = [
  { key: "PERSONAL", rate: 0.0399, min: 1500, max: 50000, maxTerm: 84, label: { fr: "Personnel", en: "Personal", nl: "Persoonlijk", de: "Privat" } },
  { key: "MORTGAGE", rate: 0.0325, min: 50000, max: 500000, maxTerm: 300, label: { fr: "Hypothécaire", en: "Mortgage", nl: "Hypotheek", de: "Hypothek" } },
  { key: "BUSINESS", rate: 0.045, min: 5000, max: 250000, maxTerm: 120, label: { fr: "Professionnel", en: "Business", nl: "Zakelijk", de: "Firma" } },
];
export default function Simulator({ locale }: { locale: Locale }) {
  const tr = (k: string) => t(locale, k);
  const [productIdx, setProductIdx] = useState(0);
  const [amount, setAmount] = useState(15000);
  const [term, setTerm] = useState(48);
  const [income, setIncome] = useState(3200);
  const [charges, setCharges] = useState(900);
  const [incomeType, setIncomeType] = useState<SimulateInput["incomeType"]>("SALARY");
  const [employment, setEmployment] = useState<SimulateInput["employmentStatus"]>("CDI");
  const [purpose, setPurpose] = useState<SimulateInput["loanPurpose"]>("VEHICLE");
  const [existing, setExisting] = useState(250);
  const p = products[productIdx];
  const result = useMemo(() => {
    try {
      return simulateCredit({ amount, termMonths: term, monthlyIncome: income, monthlyCharges: charges, incomeType, employmentStatus: employment, loanPurpose: purpose, existingCreditsMonthly: existing, country: 'BE', productType: p.key as any });
    } catch (e:any) { return { error: e.message } as any; }
  }, [amount, term, income, charges, incomeType, employment, purpose, existing, p.key]);
  const hasError = (result as any).error;
  const eur = (v: number) => formatEUR2(v, locale === "fr" ? "fr-BE" : locale === "nl" ? "nl-BE" : locale === "de" ? "de-BE" : "en-BE");
  const recoColor = result.recommendation === 'APPROVE_RECOMMENDATION' ? 'bg-emerald-500' : result.recommendation === 'REJECT_RECOMMENDATION' ? 'bg-red-500' : 'bg-amber-500';
  const recoLabel = result.recommendation === 'APPROVE_RECOMMENDATION' ? 'APPROVE' : result.recommendation === 'REJECT_RECOMMENDATION' ? 'REJECT' : 'REVIEW';
  return (
    <div className="bg-white rounded-[24px] shadow-soft border border-black/5 overflow-hidden">
      <div className="px-6 md:px-8 py-6 border-b flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge>Simulation indicative — 8 champs</Badge>
          <h3 className="text-[22px] font-extrabold mt-3 flex items-center gap-2"><Calculator className="w-5 h-5 text-primary"/>{tr("simulator.title")}</h3>
          <p className="text-sm text-slate-500">{tr("simulator.subtitle")} • Configurable BE / produit / montant / durée / taux / frais / plafonds / dates</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"><ShieldCheck className="w-3.5 h-3.5"/> {tr("hero.trust")}</div>
      </div>
      <div className="grid lg:grid-cols-5 gap-0">
        <div className="lg:col-span-3 p-6 md:p-8 space-y-5">
          <div className="flex flex-wrap gap-2">
            {products.map((prod, i) => (
              <button key={prod.key} onClick={() => { setProductIdx(i); setAmount(Math.min(Math.max(prod.min, amount), prod.max)); setTerm(Math.min(term, prod.maxTerm)); }}
                className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide uppercase border transition ${i===productIdx ? "bg-ink text-white border-ink" : "bg-white text-slate-600 border-slate-200 hover:border-ink/20"}`}>
                {prod.label[locale as keyof typeof prod.label] ?? prod.label.fr} • {(prod.rate*100).toFixed(2)}% <span className="opacity-60">dès</span>
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2"><span>{tr("simulator.amount")}</span><span className="text-ink font-extrabold">{formatEUR(amount, "fr-BE")}</span></div>
              <input type="range" min={p.min} max={p.max} step={p.key==="MORTGAGE"?5000:500} value={amount} onChange={e=>setAmount(Number(e.target.value))} className="w-full accent-primary h-2" />
              <div className="flex justify-between text-[11px] text-slate-400"><span>{formatEUR(p.min)}</span><span>{formatEUR(p.max)}</span></div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2"><span>{tr("simulator.term")}</span><span className="text-ink font-extrabold">{term} mois</span></div>
              <input type="range" min={12} max={p.maxTerm} step={12} value={term} onChange={e=>setTerm(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between text-[11px] text-slate-400"><span>12m</span><span>{p.maxTerm}m</span></div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Revenus nets <span className="normal-case text-[11px]">/mois</span>
              <input type="number" value={income} onChange={e=>setIncome(Number(e.target.value))} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm font-semibold text-ink" />
            </label>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Charges <span className="normal-case text-[11px]">loyer etc.</span>
              <input type="number" value={charges} onChange={e=>setCharges(Number(e.target.value))} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm font-semibold text-ink" />
            </label>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Crédits existants
              <input type="number" value={existing} onChange={e=>setExisting(Number(e.target.value))} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm font-semibold text-ink" />
            </label>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Type de revenus
              <select value={incomeType} onChange={e=>setIncomeType(e.target.value as any)} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm bg-white">
                <option value="SALARY">Salaire</option><option value="SELF_EMPLOYED">Indépendant</option><option value="PENSION">Pension</option><option value="UNEMPLOYMENT">Chômage</option><option value="OTHER">Autre</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Situation pro
              <select value={employment} onChange={e=>setEmployment(e.target.value as any)} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm bg-white">
                <option value="CDI">CDI</option><option value="CDD">CDD</option><option value="INDEPENDENT">Indépendant</option><option value="INTERIM">Intérim</option><option value="RETIRED">Retraité</option><option value="STUDENT">Étudiant</option><option value="UNEMPLOYED">Sans emploi</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Objet du crédit
              <select value={purpose} onChange={e=>setPurpose(e.target.value as any)} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm bg-white">
                <option value="VEHICLE">Véhicule</option><option value="WORKS">Travaux</option><option value="CONSUMPTION">Conso</option><option value="DEBT_CONSOLIDATION">Regroupement</option><option value="MEDICAL">Médical</option><option value="OTHER">Autre</option>
              </select>
            </label>
          </div>
          {!hasError ? (
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-surface rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.monthly")}</div><div className="text-[22px] font-extrabold text-ink">{eur(result.simulation.monthlyPayment)}</div><div className="text-[11px] text-slate-400">/ mois</div></div>
              <div className="bg-surface rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.taeg")}</div><div className="text-[22px] font-extrabold text-ink">{(result.simulation.taeg*100).toFixed(2)}%</div><div className="text-[11px] text-slate-400">TAEG indicatif</div></div>
              <div className="bg-surface rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.total")}</div><div className="text-[22px] font-extrabold text-ink">{eur(result.simulation.totalCost)}</div><div className="text-[11px] text-emerald-600">dont {eur(result.simulation.totalInterest)} intérêts + {eur(result.simulation.fees.total)} frais</div></div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5"/>{(result as any).error}</div>
          )}
          {!hasError && (
            <div className="grid md:grid-cols-3 gap-3">
              <div className={`rounded-2xl p-4 border text-white ${recoColor}`}>
                <div className="text-[11px] tracking-widest uppercase font-bold opacity-90">Recommandation moteur</div>
                <div className="text-lg font-extrabold flex items-center gap-2 mt-1">
                  {result.recommendation==='APPROVE_RECOMMENDATION' && <CheckCircle className="w-5 h-5"/>}
                  {result.recommendation==='REJECT_RECOMMENDATION' && <XCircle className="w-5 h-5"/>}
                  {result.recommendation==='REVIEW_RECOMMENDATION' && <Eye className="w-5 h-5"/>}
                  {recoLabel}
                </div>
                <div className="text-xs opacity-80 mt-1">ADMIN décide — jamais auto</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">Endettement</div><div className={`text-lg font-extrabold ${result.eligibility.debtRatio>0.33?'text-amber-600': 'text-emerald-600'}`}>{(result.eligibility.debtRatio*100).toFixed(1)}%</div><div className="text-xs text-slate-500">Capacité {eur(result.eligibility.repaymentCapacity)}</div></div>
              <div className="bg-white rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">Score</div><div className="text-lg font-extrabold text-ink">{result.score.value} <span className="text-sm font-bold px-2 py-1 rounded-full bg-ink text-white ml-1">{result.score.grade}</span></div><div className="text-xs text-slate-500">{result.score.explanation}</div></div>
            </div>
          )}
          {!hasError && result.warnings?.length>0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              {result.warnings.map((w:any)=> (
                <div key={w.code} className="text-xs flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5"/>{w.message}</div>
              ))}
            </div>
          )}
          {!hasError && (
            <div className="flex flex-wrap gap-2">
              <Button className="gap-2">{tr("simulator.request")} <ArrowRight className="w-4 h-4"/></Button>
              <button className="inline-flex items-center gap-2 h-11 px-5 rounded-full border text-sm font-semibold"><FileText className="w-4 h-4"/> Docs requis ({result.requiredDocuments.length})</button>
            </div>
          )}
          <p className="text-[11px] leading-5 text-slate-500 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>{tr("simulator.legal")}</p>
        </div>
        <div className="lg:col-span-2 bg-ink text-white p-6 md:p-8 overflow-hidden">
          {!hasError ? (
            <>
              <h4 className="font-extrabold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> Échéancier (12 premiers / {term})</h4>
              <p className="text-xs text-white/60">Frais dossier {eur(result.simulation.fees.file)} — TAEG indicatif {(result.simulation.taeg*100).toFixed(2)}% — BE {result.simulation.meta.product}</p>
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                <div className="grid grid-cols-4 text-[10px] tracking-widest uppercase font-bold text-white/50 bg-white/5 px-3 py-2"><span>#</span><span>Intérêts</span><span>Capital</span><span className="text-right">Restant</span></div>
                <div className="max-h-[260px] overflow-auto divide-y divide-white/5">
                  {result.simulation.schedule.slice(0,12).map((r:any)=>(
                    <div key={r.month} className="grid grid-cols-4 text-xs px-3 py-2 font-medium"><span className="text-white/70">{r.month}</span><span>{eur(r.interest)}</span><span>{eur(r.principal)}</span><span className="text-right font-bold">{eur(r.balance)}</span></div>
                  ))}
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs leading-5">
                <strong className="text-white flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Détail scoring:</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(result.score.breakdown).map(([k,v])=> <span key={k} className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-[11px]">{k}:{v as number}</span>)}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold tracking-widest uppercase text-white/50 mb-2">Documents requis</div>
                <div className="space-y-1">
                  {result.requiredDocuments.map((d:any)=> <div key={d.code} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10"><FileWarning className="w-3 h-3 text-amber-300"/>{d.label} {d.required?'*':''}</div>)}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-white/70">Corrige les paramètres pour voir l'échéancier.</div>
          )}
          <div className="mt-4 flex gap-2 text-[11px]"><span className="px-2 py-1 rounded-full bg-white text-ink font-bold">BE • EUR</span><span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">Configurable</span></div>
        </div>
      </div>
    </div>
  );
}
