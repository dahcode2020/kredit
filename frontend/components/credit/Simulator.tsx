"use client";
import { useMemo, useState } from "react";
import { formatEUR, formatEUR2 } from "@/lib/utils";
import { formatPercent } from "@/lib/formatters";
import { Button, Badge } from "@/components/ui/Button";
import CountUp from "@/components/motion/CountUp";
import Reveal from "@/components/motion/Reveal";
import { Info, ShieldCheck, Calculator, FileWarning, ArrowRight, Sparkles, AlertTriangle, CheckCircle, XCircle, Eye, FileText, TrendingUp } from "lucide-react";
import { Locale, t, tNs } from "@/lib/i18n";
import { useDemande } from "@/hooks/useDemande";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  simulateCredit, SimulateInput, INCOME_TYPES, EMPLOYMENT_STATUSES, LOAN_PURPOSES,
  PRODUITS, PRODUCT_TYPES, tauxPour, tauxMiniProduit, type ProductCode,
} from "@/lib/credit-engine";
// Plus de `label: { fr: "…", en: "…" }` par produit : c'était un dictionnaire parallèle dans le
// composant (deuxième source de vérité — la clé manque, et l'onglet affiche un objet ou le français).
// L'étiquette est désormais `simulator.tab.<code>`, le code restant la seule chose partagée avec le moteur.
/**
 * Les onglets sont une PROJECTION du moteur, plus une declaration parallele. Avant: trois lignes ici
 * (taux, bornes, durees) pour trois lignes dans `lib/credit-engine.ts` et une liste dans le backend —
 * trois sources pour une seule realite commerciale, et un composant qui continuait a annoncer 3,25 %
 * apres un changement de grille.
 */
const products = PRODUCT_TYPES.map((code) => ({ key: code, ...PRODUITS[code] })) as {
  key: ProductCode; min: number; max: number; minTerm: number; maxTerm: number; pas: number;
}[];

/**
 * Reglette logarithmique. Avec un plafond a 30 000 000 EUR et un plancher a 1 500 EUR, une
 * interpolation lineaire rendrait 99 % de la course inutile: les 40 premiers pour cent du curseur
 * couvriraient 12 millions d'euros. On repartit donc la position en log(montant), et on re-quantifie
 * a la sortie sur le pas du produit — le montant reste un multiple propre du pas, jamais un nombre
 * a virgule tombe entre deux paliers de taux.
 */
export const POSITIONS = 1000;
export function versPosition(valeur: number, min: number, max: number) {
  if (!(max > min) || !(valeur > 0) || !(min > 0)) return 0;
  return Math.round((Math.log(Math.min(max, Math.max(min, valeur)) / min) / Math.log(max / min)) * POSITIONS);
}
export function depuisPosition(position: number, min: number, max: number, pas: number) {
  if (!(max > min) || !(min > 0)) return min;
  const brut = min * Math.exp((Math.min(POSITIONS, Math.max(0, position)) / POSITIONS) * Math.log(max / min));
  const quantifie = Math.round(brut / pas) * pas;
  return Math.min(max, Math.max(min, quantifie));
}
export default function Simulator({ locale }: { locale: Locale }) {
  const router = useRouter();
  const ta = (cle: string, vars?: Record<string, any>) => tNs(locale, "auth", cle, vars);
  const tr = (k: string, vars?: Record<string, any>) => t(locale, k, vars);
  /**
   * Le moteur de calcul renvoie des libellés (pièces, explication de score, alertes) — donc une chaîne
   * française qui traverse directement dans l'interface des quatre marchés. On cherche d'abord la clé
   * i18n dérivée du **code** ; à défaut on rend ce que le moteur a fourni, sans jamais afficher la clé
   * brute. Une clé ajoutée côté dictionnaires reprend la main sans toucher au moteur.
   */
  const trOu = (cle: string, fallback: string, vars?: Record<string, any>) => {
    const rendu = tr(cle, vars);
    return rendu === cle ? fallback : rendu;
  };
  const [productIdx, setProductIdx] = useState(0);
  const [plisDocs, setPlisDocs] = useState(false);
  const brouillon = useDemande((st) => st.simulation);
  const poserSimulation = useDemande((st) => st.poserSimulation);
  const depotRecent = useDemande((st) => st.depots[0]?.reference);
  const [amount, setAmount] = useState(15_000);
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
  // Locale dérivée du segment [locale] et convertie dans lib/ (ni `undefined`, ni "fr-BE" en dur,
  // ni tag Intl choisi par le composant → plus de mismatch de formatage à l'hydratation).
  const eur = (v: number) => formatEUR2(v, locale);
  /** Variables d'interpolation des alertes du moteur (le moteur ne connaît pas les langues). */
  const varsWarning = (code: string): Record<string, any> => {
    const e: any = (result as any).eligibility ?? {};
    const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
    if (code === "AT_CEILING") return { pct: pct(e.maxAllowedAmount ? amount / e.maxAllowedAmount : 1) };
    if (code === "LOW_CAPACITY") return { capacity: eur(Number(e.repaymentCapacity ?? 0)) };
    return { pct: pct(Number(e.debtRatio ?? 0)) };
  };
  /**
   * Le brouillon part avec les valeurs *du moment* (et pas seulement celles de la simulation
   * précédente): le formulaire doit reprendre ce que l'utilisateur vient de lire à l'écran.
   * L'horodatage se pose ici, dans un gestionnaire — jamais au render (date serveur ≠ date client).
   */
  const demander = () => {
    if (!hasError) {
      poserSimulation({
        produit: p.key, montant: amount, duree: term, revenu: income, charges, credits: existing,
        typeRevenu: incomeType, statut: employment, objet: purpose,
        mensualite: result.simulation.monthlyPayment, taeg: result.simulation.taeg,
        interets: result.simulation.totalInterest, coutTotal: result.simulation.totalCost,
        score: result.score.value, grade: result.score.grade, recommandation: result.recommendation,
        simulateLe: new Date().toISOString(),
      });
    }
    router.push(`/${locale}/demande`);
  };

  const recoColor = result.recommendation === 'APPROVE_RECOMMENDATION' ? 'bg-emerald-500' : result.recommendation === 'REJECT_RECOMMENDATION' ? 'bg-red-500' : 'bg-amber-500';
  const recoLabel = result.recommendation === 'APPROVE_RECOMMENDATION' ? 'APPROVE' : result.recommendation === 'REJECT_RECOMMENDATION' ? 'REJECT' : 'REVIEW';
  return (
    <div className="bg-white rounded-[24px] shadow-soft border border-black/5 overflow-hidden">
      <div className="px-6 md:px-8 py-6 border-b flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge>{tr("simulator.badge")}</Badge>
          <h3 className="text-[22px] font-extrabold mt-3 flex items-center gap-2"><Calculator className="w-5 h-5 text-primary"/>{tr("simulator.title")}</h3>
          <p className="text-sm text-slate-500">{tr("simulator.subtitle")} • {tr("simulator.configurableNote")}</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100"><ShieldCheck className="w-3.5 h-3.5"/> {tr("hero.trust")}</div>
      </div>
      <div className="grid lg:grid-cols-5 gap-0">
        <div className="lg:col-span-3 p-6 md:p-8 space-y-5">
          <div className="flex flex-wrap gap-2">
            {products.map((prod, i) => (
              <button key={prod.key} onClick={() => {
                setProductIdx(i);
                // Re-quantifie sur le pas du produit: un montant herite d'un autre onglet (15 250 €
                // vers un produit au pas de 5 000) sinon reste hors grille et affiche une erreur.
                setAmount(Math.min(prod.max, Math.max(prod.min, Math.round(Math.min(Math.max(prod.min, amount), prod.max) / prod.pas) * prod.pas)));
                setTerm(Math.min(prod.maxTerm, Math.max(prod.minTerm, term)));
              }}
                className={`px-4 py-2 rounded-full text-xs font-bold tracking-wide uppercase border transition ${i===productIdx ? "bg-ink text-white border-ink" : "bg-white text-slate-600 border-slate-200 hover:border-ink/20"}`}>
                {tr(`simulator.tab.${prod.key}`)} • <span className="opacity-80">{tr("simulator.from")}</span> {formatPercent(tauxMiniProduit(prod.key), locale, 2)}
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                <span>{tr("simulator.amount")}</span>
                {/* Le taux qui s'applique réellement à CE montant, à côté du montant: c'est la grille
                    par paliers, donc l'afficher ailleurs que là serait un chiffre décoratif. Zéro
                    nouvelle chaîne: un point-milieu technique et un pourcentage. */}
                <span className="text-ink font-extrabold">
                  {formatEUR(amount, locale)}
                  {tauxPour(amount) !== null && (
                    <span className="text-slate-400 font-bold"> · {formatPercent(tauxPour(amount) as number, locale, 2)}</span>
                  )}
                </span>
              </div>
              <input
                type="range" min={0} max={POSITIONS} step={1}
                value={versPosition(amount, p.min, p.max)}
                onChange={e => setAmount(depuisPosition(Number(e.target.value), p.min, p.max, p.pas))}
                aria-valuetext={formatEUR(amount, locale)}
                className="w-full accent-primary h-2"
              />
              <div className="flex justify-between text-[11px] text-slate-400"><span>{formatEUR(p.min, locale)}</span><span>{formatEUR(p.max, locale)}</span></div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2"><span>{tr("simulator.term")}</span><span className="text-ink font-extrabold">{tr("simulator.months", { term })}</span></div>
              <input type="range" min={p.minTerm} max={p.maxTerm} step={12} value={term} onChange={e=>setTerm(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between text-[11px] text-slate-400"><span>12m</span><span>{p.maxTerm}m</span></div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{tr("simulator.income")} <span className="normal-case text-[11px]">{tr("simulator.perMonth")}</span>
              <input type="number" value={income} onChange={e=>setIncome(Number(e.target.value))} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm font-semibold text-ink" />
            </label>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{tr("simulator.charges")} <span className="normal-case text-[11px]">{tr("simulator.chargesNote")}</span>
              <input type="number" value={charges} onChange={e=>setCharges(Number(e.target.value))} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm font-semibold text-ink" />
            </label>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{tr("simulator.existingCredits")}
              <input type="number" value={existing} onChange={e=>setExisting(Number(e.target.value))} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm font-semibold text-ink" />
            </label>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{tr("simulator.incomeTypeLabel")}
              <select value={incomeType} onChange={e=>setIncomeType(e.target.value as any)} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm bg-white">
                {INCOME_TYPES.map((code) => <option key={code} value={code}>{tr(`simulator.incomeType.${code}`)}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{tr("simulator.employmentLabel")}
              <select value={employment} onChange={e=>setEmployment(e.target.value as any)} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm bg-white">
                {EMPLOYMENT_STATUSES.map((code) => <option key={code} value={code}>{tr(`simulator.employment.${code}`)}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">{tr("simulator.purposeLabel")}
              <select value={purpose} onChange={e=>setPurpose(e.target.value as any)} className="mt-1 w-full h-10 rounded-xl border px-3 text-sm bg-white">
                {LOAN_PURPOSES.map((code) => <option key={code} value={code}>{tr(`simulator.purpose.${code}`)}</option>)}
              </select>
            </label>
          </div>
          {!hasError ? (
            <Reveal as="div" variant="up" pas={16} className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-surface rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.monthly")}</div><div className="text-[22px] font-extrabold text-ink"><CountUp declencheur="montage" a={result.simulation.monthlyPayment} final={eur(result.simulation.monthlyPayment)} format={eur} duree={520} /></div><div className="text-[11px] text-slate-400">{tr("simulator.perMonth")}</div></div>
              <div className="bg-surface rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.taeg")}</div><div className="text-[22px] font-extrabold text-ink"><CountUp declencheur="montage" a={result.simulation.taeg*100} final={`${(result.simulation.taeg*100).toFixed(2)}%`} format={(n) => `${n.toFixed(2)}%`} duree={420} /></div><div className="text-[11px] text-slate-400">{tr("simulator.taegIndicative")}</div></div>
              <div className="bg-surface rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.total")}</div><div className="text-[22px] font-extrabold text-ink"><CountUp declencheur="montage" a={result.simulation.totalCost} final={eur(result.simulation.totalCost)} format={eur} duree={620} /></div><div className="text-[11px] text-emerald-600">{tr("simulator.breakdown", { interest: eur(result.simulation.totalInterest), fees: eur(result.simulation.fees.total) })}</div></div>
            </Reveal>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5"/>{(result as any).error}</div>
          )}
          {!hasError && (
            <div className="grid md:grid-cols-3 gap-3">
              <div key={result.recommendation} className={`motion-pop rounded-2xl p-4 border text-white ${recoColor}`}>
                <div className="text-[11px] tracking-widest uppercase font-bold opacity-90">{tr("simulator.engineRecommendation")}</div>
                <div className="text-lg font-extrabold flex items-center gap-2 mt-1">
                  {result.recommendation==='APPROVE_RECOMMENDATION' && <CheckCircle className="w-5 h-5"/>}
                  {result.recommendation==='REJECT_RECOMMENDATION' && <XCircle className="w-5 h-5"/>}
                  {result.recommendation==='REVIEW_RECOMMENDATION' && <Eye className="w-5 h-5"/>}
                  {recoLabel}
                </div>
                <div className="text-xs opacity-80 mt-1">{tr("simulator.humanDecision")}</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("eligibility.debtRatio")}</div><div className={`text-lg font-extrabold ${result.eligibility.debtRatio>0.33?'text-amber-600': 'text-emerald-600'}`}><CountUp declencheur="montage" a={result.eligibility.debtRatio*100} final={`${(result.eligibility.debtRatio*100).toFixed(1)}%`} format={(n) => `${n.toFixed(1)}%`} duree={420} /></div><div className="text-xs text-slate-500">{tr("eligibility.capacity")} {eur(result.eligibility.repaymentCapacity)}</div></div>
              <div className="bg-white rounded-2xl p-4 border"><div className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("simulator.score")}</div><div className="text-lg font-extrabold text-ink"><CountUp declencheur="montage" a={result.score.value} final={String(result.score.value)} format={(n) => String(Math.round(n))} duree={700} /> <span className="text-sm font-bold px-2 py-1 rounded-full bg-ink text-white ml-1">{result.score.grade}</span></div><div className="text-xs text-slate-500">{trOu("simulator.scoreExplanation", result.score.explanation, { value: result.score.value, grade: result.score.grade, pct: `${(result.eligibility.debtRatio*100).toFixed(1)}%` })}</div></div>
            </div>
          )}
          {!hasError && result.warnings?.length>0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              {result.warnings.map((w:any)=> (
                <div key={w.code} className="text-xs flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5"/>{trOu(`simulator.warning.${w.code}`, w.message, varsWarning(w.code))}</div>
              ))}
            </div>
          )}
          {/* Le CTA de demande était un <Button> sans action: la seule issue du simulateur menait
              nulle part. Il devient la bande qui porte le brouillon jusqu'au formulaire — le montant,
              la durée, les revenus et l'objet partirent avec, donc plus de resaisie. */}
          {!hasError && (
            <div className="flex flex-wrap gap-2">
              <div className="w-full rounded-[20px] border overflow-hidden">
                <div className={`px-5 py-4 flex flex-wrap items-center gap-4 ${result.recommendation === "REJECT_RECOMMENDATION" ? "bg-ink" : "bg-primary"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-extrabold text-white">{ta("demande.cta")}</div>
                    <div className="text-[11px] leading-4 text-white/75 mt-0.5">
                      {result.recommendation === "REJECT_RECOMMENDATION" ? ta("demande.rejeterNote") : ta("demande.ctaAide")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={demander}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white text-ink text-[13px] font-extrabold sheen transition active:scale-[.98]"
                  >
                    {depotRecent ? ta("demande.dejaDepose", { ref: depotRecent }) : tr("simulator.request")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="px-5 py-3 bg-white flex flex-wrap items-center gap-x-4 gap-y-2">
                  <button type="button" onClick={() => setPlisDocs((v) => !v)} className="inline-flex items-center gap-2 text-[12px] font-bold text-slate-600 hover:text-ink transition">
                    <FileText className="w-4 h-4" /> {ta("demande.documents", { n: result.requiredDocuments.length })}
                  </button>
                  {brouillon ? <Link href={`/${locale}/demande`} className="ml-auto text-[12px] font-bold text-primary hover:underline">{ta("demande.titre")}</Link> : null}
                </div>
                {plisDocs ? (
                  <ul className="px-5 pb-4 grid sm:grid-cols-2 gap-2">
                    {result.requiredDocuments.map((d: any) => (
                      <li key={d.code} className="flex gap-2 text-[12px] text-slate-600">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        {trOu(`documents.${d.code}`, d.label)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}
          <p className="text-[11px] leading-5 text-slate-500 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2"><Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"/>{tr("simulator.legal")}</p>
        </div>
        <div className="lg:col-span-2 bg-ink text-white p-6 md:p-8 overflow-hidden">
          {!hasError ? (
            <>
              <h4 className="font-extrabold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary"/> {tr("simulator.scheduleTitle", { shown: Math.min(12, term), total: term })}</h4>
              <p className="text-xs text-white/60">{tr("simulator.fileFee")} {eur(result.simulation.fees.file)} — {tr("simulator.taegIndicative")} {(result.simulation.taeg*100).toFixed(2)}% — BE {result.simulation.meta.product}</p>
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                <div className="grid grid-cols-4 text-[10px] tracking-widest uppercase font-bold text-white/50 bg-white/5 px-3 py-2"><span>#</span><span>{tr("simulator.interests")}</span><span>{tr("simulator.principal")}</span><span className="text-right">{tr("simulator.balance")}</span></div>
                <div className="max-h-[260px] overflow-auto divide-y divide-white/5">
                  {result.simulation.schedule.slice(0,12).map((r:any)=>(
                    <div key={r.month} className="grid grid-cols-4 text-xs px-3 py-2 font-medium"><span className="text-white/70">{r.month}</span><span>{eur(r.interest)}</span><span>{eur(r.principal)}</span><span className="text-right font-bold">{eur(r.balance)}</span></div>
                  ))}
                </div>
              </div>
              <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs leading-5">
                <strong className="text-white flex items-center gap-1"><TrendingUp className="w-3 h-3"/> {tr("simulator.scoringDetail")}</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(result.score.breakdown).map(([k,v])=> <span key={k} className="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-[11px]">{trOu(`simulator.scoreFactor.${k}`, k)}: {v as number}</span>)}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold tracking-widest uppercase text-white/50 mb-2">{tr("simulator.requiredDocs")}</div>
                <div className="space-y-1">
                  {result.requiredDocuments.map((d:any)=> <div key={d.code} className="text-xs flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/10"><FileWarning className="w-3 h-3 text-amber-300"/>{trOu(`documents.${d.code}`, d.label)} {d.required?'*':''}</div>)}
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm text-white/70">{tr("simulator.fixParams")}</div>
          )}
          <div className="mt-4 flex gap-2 text-[11px]"><span className="px-2 py-1 rounded-full bg-white text-ink font-bold">BE • EUR</span><span className="px-2 py-1 rounded-full bg-white/10 border border-white/10">{tr("simulator.configurable")}</span></div>
        </div>
      </div>
    </div>
  );
}
