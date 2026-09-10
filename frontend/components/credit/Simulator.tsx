"use client";
import { useMemo, useState } from "react";
import { amortize, formatEUR, formatEUR2 } from "@/lib/utils";
import { Button, Badge } from "@/components/ui/Button";
import { Info, ShieldCheck, Calculator, FileWarning, ArrowRight, Sparkles } from "lucide-react";
import { Locale, t } from "@/lib/i18n";

const products = [
  { key: "personal", rate: 0.0399, min: 1500, max: 50000, maxTerm: 84, label: { fr: "Personnel", en: "Personal", nl: "Persoonlijk", de: "Privat" } },
  { key: "mortgage", rate: 0.0325, min: 50000, max: 500000, maxTerm: 300, label: { fr: "Hypothécaire", en: "Mortgage", nl: "Hypotheek", de: "Hypothek" } },
  { key: "business", rate: 0.045, min: 5000, max: 250000, maxTerm: 120, label: { fr: "Professionnel", en: "Business", nl: "Zakelijk", de: "Firma" } },
];

export default function Simulator({ locale }: { locale: Locale }) {
  const tr = (k: string) => t(locale, k);
  const [productIdx, setProductIdx] = useState(0);
  const [amount, setAmount] = useState(15000);
  const [term, setTerm] = useState(48);
  const p = products[productIdx];
  const calc = useMemo(() => amortize(amount, p.rate, term), [amount, p.rate, term]);
  const eur = (v: number) => formatEUR2(v, locale === "fr" ? "fr-BE" : locale === "nl" ? "nl-BE" : locale === "de" ? "de-BE" : "en-BE");

  return (
    <div className="bg-white rounded-[24px] shadow-soft border border-black/5 overflow-hidden">
      <div className="px-6 md:px-8 py-6 border-b flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge>Simulation indicative</Badge>
          <h3 className="text-[22px] font-extrabold mt-3 flex items-center gap-2"><Calculator className="w-5 h-5 text-primary"/>{tr("simulator.title")}</h3>
          <p className="text-sm text-slate-500">{tr("simulator.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"><ShieldCheck className="w-3.5 h-3.5"/> {tr("hero.trust")}</div>
      </div>

      <div className="grid lg:grid-cols-5 gap-0">
        <div className="lg:col-span-3 p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap gap-2">
            {products.map((prod, i) => (
              <button key={prod.key} onClick={() => { setProductIdx(i); setAmount(Math.min(Math.max(prod.min, amount), prod.max)); setTerm(Math.min(term, prod.maxTerm)); }}
                className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide uppercase border transition ${i===productIdx ? "bg-ink text-white border-ink" : "bg-white text-slate-600 border-slate-200 hover:border-ink/20"}`}>
                {prod.label[locale as keyof typeof prod.label] ?? prod.label.fr} • {(prod.rate*100).toFixed(2)}% TAEG <span className="opacity-60">dès</span>
              </button>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2"><span>{tr("simulator.amount")}</span><span className="text-ink text-sm normal-case tracking-normal font-extrabold">{formatEUR(amount, "fr-BE")}</span></div>
            <input type="range" min={p.min} max={p.max} step={p.key==="mortgage"?5000:500} value={amount} onChange={e=>setAmount(Number(e.target.value))} className="w-full accent-primary h-2" />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>{formatEUR(p.min)}</span><span>{formatEUR(p.max)}</span></div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2"><span>{tr("simulator.term")}</span><span className="text-ink text-sm normal-case tracking-normal font-extrabold">{term} mois</span></div>
            <input type="range" min={12} max={p.maxTerm} step={12} value={term} onChange={e=>setTerm(Number(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>12 mois</span><span>{p.maxTerm} mois</span></div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-surface rounded-2xl p-4 border border-black/5"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.monthly")}</div><div className="text-[22px] font-extrabold text-ink">{eur(calc.monthly)}</div><div className="text-[11px] text-slate-400">/ mois</div></div>
            <div className="bg-surface rounded-2xl p-4 border border-black/5"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.taeg")}</div><div className="text-[22px] font-extrabold text-ink">{(p.rate*100).toFixed(2)}%</div><div className="text-[11px] text-slate-400">indicatif</div></div>
            <div className="bg-surface rounded-2xl p-4 border border-black/5"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.total")}</div><div className="text-[22px] font-extrabold text-ink">{eur(calc.total)}</div><div className="text-[11px] text-emerald-600">dont {eur(calc.totalInterest)} intérêts</div></div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button className="gap-2">{tr("simulator.request")} <ArrowRight className="w-4 h-4"/></Button>
            <button className="inline-flex items-center gap-2 h-11 px-6 rounded-full border border-slate-200 text-sm font-semibold hover:bg-surface">Télécharger PDF (SIMULATION) <FileWarning className="w-4 h-4 text-amber-500"/></button>
          </div>

          <p className="text-[11px] leading-5 text-slate-500 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>{tr("simulator.legal")}</p>
        </div>

        <div className="lg:col-span-2 bg-ink text-white p-6 md:p-8">
          <h4 className="font-extrabold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> Échéancier (aperçu 12 mois)</h4>
          <p className="text-xs text-white/60 mt-1">Méthode française — mensualité constante. Auditée côté moteur.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <div className="grid grid-cols-4 text-[10px] tracking-widest uppercase font-bold text-white/50 bg-white/5 px-3 py-2"><span>#</span><span>Intérêts</span><span>Capital</span><span className="text-right">Restant</span></div>
            <div className="max-h-[280px] overflow-auto divide-y divide-white/5">
              {calc.schedule.slice(0, 12).map(r => (
                <div key={r.month} className="grid grid-cols-4 text-xs px-3 py-2.5 font-medium">
                  <span className="text-white/70">{r.month}</span><span className="text-white/80">{eur(r.interest)}</span><span className="text-white/80">{eur(r.principal)}</span><span className="text-right text-white font-bold">{eur(r.balance)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs leading-5 text-white/70">
            <strong className="text-white">Rappel conformité:</strong> Simulation ≠ offre ferme. Décision soumise à KYC, scoring et validation humaine (ADMIN). Dérogation possible mais tracée avec motif (SUPER_ADMIN au-delà du seuil).
          </div>
          <div className="mt-4 flex gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded-full bg-white text-ink font-bold">BE • EUR</span>
            <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/10">Configurable par pays</span>
          </div>
        </div>
      </div>
    </div>
  );
}
