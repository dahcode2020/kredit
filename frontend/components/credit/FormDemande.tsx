"use client";
/**
 * Le formulaire de demande — l'étape que le brief demande de rendre évidente après une simulation.
 *
 * Trois principes, chacun lié à un piège déjà rencontré sur ce dépôt :
 *
 * 1. **La simulation n'est pas resaisie, elle est reprise.** Montant, durée, revenus, charges,
 *    crédits, produit et objet viennent du brouillon posé par le simulateur (`useDemande`), et le
 *    panneau de droite reste calculé en direct sur ces valeurs : si l'utilisateur change le montant
 *    ici, la mensualité, le TAEG et le score bougent avec. Un récap figé serait un mensonge de plus.
 * 2. **Le compte se crée ici, pas dans un tunnel séparé.** Un visiteur qui n'a pas encore de compte
 *    remplit l'étape 1 et dépose dans la foulée ; un visiteur connecté saute cette étape (le champ
 *    devient une ligne de contexte, pas un questionnaire).
 * 3. **Le moteur de crédit reste la seule autorité.** Les bornes d'un champ ne sont pas écrites dans
 *    ce fichier : `PRODUITS` décide de la plage du montant et de la durée, `simulateCredit` du
 *    résultat, `findRateRule` du taux. Un formulaire qui inventerait « jusqu'à 50 000 € » est la
 *    dérive que la grille du 12/09/2026 a justement fallu nettoyer à six endroits.
 *
 * Hydratation : le brouillon persisté est relu **en effet**, jamais au render — sinon le premier
 * rendu client diffère du HTML servi, et ce dépôt connaît le prix de cette économie.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Calculator, FileCheck, Lock, ShieldCheck, Wallet } from "lucide-react";
import Reveal from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/Button";
import { useAuth, useAuthHydrated } from "@/hooks/useAuth";
import { useDemande, useDemandeHydratee, type ChampsDemande } from "@/hooks/useDemande";
import {
  EMPLOYMENT_STATUSES, INCOME_TYPES, LOAN_PURPOSES, PRODUITS, PRODUCT_TYPES, simulateCredit,
  type ProductCode,
} from "@/lib/credit-engine";
import { emailValide, motDePasseValide, referenceDossier, sInscrire, telephoneValide } from "@/lib/auth-service";
import { Locale, t, tNs } from "@/lib/i18n";
import { formatEUR, formatEUR2 } from "@/lib/utils";
import { formatMontantCompact, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type Numeric = { montant: number; duree: number; revenu: number; charges: number; credits: number };
type Selects = { produit: ProductCode; objet: string; statut: string; typeRevenu: string };
type Erreurs = Record<string, string | undefined>;

const ETAPES = ["demande.etape1", "demande.etape2", "demande.etape3", "demande.etape4"] as const;
const FOYER = ["celibataire", "marie", "cohabite", "divorce", "veuf"] as const;

/** Âge au jour du dépôt — jamais au render: une date « aujourd'hui » diffère entre le serveur et le navigateur. */
function âgeAuJour(naissance: string, aujourdhui: Date): number | null {
  if (!naissance) return null;
  const b = new Date(naissance);
  if (Number.isNaN(b.getTime())) return null;
  let a = aujourdhui.getFullYear() - b.getFullYear();
  const m = aujourdhui.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && aujourdhui.getDate() < b.getDate())) a--;
  return a;
}

export default function FormDemande({ locale }: { locale: Locale }) {
  const ta = useCallback((cle: string, vars?: Record<string, any>) => tNs(locale, "auth", cle, vars), [locale]);
  const tr = useCallback((cle: string, vars?: Record<string, any>) => t(locale, cle, vars), [locale]);
  const router = useRouter();
  const { isAuthenticated, user } = useAuthHydrated();
  const login = useAuth((s) => s.login);
  const { pret, simulation, champs: champsStockes, etape: etapeStockee, majChamp, allerA, deposer, vider } = useDemandeHydratee();

  const [etape, setEtape] = useState(0);
  const [champs, setChamps] = useState<Partial<ChampsDemande>>({ pays: "BE" });
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [numerique, setNumerique] = useState<Numeric>({ montant: 15_000, duree: 48, revenu: 3_200, charges: 600, credits: 0 });
  const [choix, setChoix] = useState<Selects>({ produit: "PERSONAL", objet: "CONSUMPTION", statut: "CDI", typeRevenu: "SALARY" });
  const [accorde, setAccorde] = useState({ gdpr: false, offre: false });
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [encours, setEncours] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // Reprise du brouillon: une seule fois, après hydratation (voir l'en-tête du fichier).
  useEffect(() => {
    if (!pret) return;
    if (Object.keys(champsStockes).length) setChamps((c) => ({ ...c, ...champsStockes }));
    if (simulation) {
      setNumerique({ montant: simulation.montant, duree: simulation.duree, revenu: simulation.revenu, charges: simulation.charges, credits: simulation.credits });
      setChoix({ produit: simulation.produit, objet: simulation.objet, statut: simulation.statut, typeRevenu: simulation.typeRevenu });
      setChamps((c) => ({ ...c, prenom: c.prenom ?? "", nom: c.nom ?? "" }));
    }
    setEtape(etapeStockee ?? 0);
  }, [pret, champsStockes, simulation, etapeStockee]);

  const maj = (cle: keyof ChampsDemande) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const valeur = e.target.value;
    setChamps((c) => ({ ...c, [cle]: valeur }));
    majChamp({ [cle]: valeur } as Partial<ChampsDemande>);
    setErreurs((err) => (err[cle] ? { ...err, [cle]: undefined } : err));
  };
  const majNb = (cle: keyof Numeric) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = Number(e.target.value.replace(/[^\d.]/g, ""));
    setNumerique((v) => ({ ...v, [cle]: Number.isFinite(n) ? n : 0 }));
  };

  const limites = PRODUITS[choix.produit];

  // Le récap est calculé sur l'état courant: c'est CE que l'utilisateur est en train d'écrire qui est
  // transmis au conseiller, pas la simulation d'hier.
  const recalcule = useMemo(() => {
    try {
      const r = simulateCredit({
        amount: numerique.montant, termMonths: numerique.duree, monthlyIncome: numerique.revenu,
        monthlyCharges: numerique.charges, incomeType: choix.typeRevenu as any, employmentStatus: choix.statut as any,
        loanPurpose: choix.objet as any, existingCreditsMonthly: numerique.credits, country: "BE", productType: choix.produit,
      });
      return { erreur: null as string | null, r };
    } catch (e: any) {
      return { erreur: (e?.message ?? "") as string, r: null as any };
    }
  }, [numerique, choix]);

  const valider = (n: number): Erreurs => {
    const e: Erreurs = {};
    if (n === 0 && !isAuthenticated) {
      if (!champs.prenom?.trim()) e.prenom = ta("erreur.champRequis");
      if (!champs.nom?.trim()) e.nom = ta("erreur.champRequis");
      if (!emailValide(champs.email ?? "")) e.email = ta("erreur.email");
      if (!motDePasseValide(mdp)) e.motDePasse = ta("erreur.motDePasse");
      if (mdp !== mdp2) e.confirmation = ta("erreur.confirmation");
      if (champs.telephone && !telephoneValide(champs.telephone)) e.telephone = ta("erreur.telephone");
    }
    if (n === 1) {
      if (!choix.statut) e.statut = ta("erreur.champRequis");
      if (!(numerique.revenu > 0)) e.revenu = ta("erreur.champRequis");
      const age = âgeAuJour(champs.naissance ?? "", new Date());
      if (age !== null && age < 18) e.naissance = ta("erreur.age");
    }
    if (n === 2) {
      if (numerique.montant < limites.min || numerique.montant > limites.max) {
        e.montant = ta("erreur.plage", { min: formatMontantCompact(limites.min, locale), max: formatMontantCompact(limites.max, locale) });
      }
      if (numerique.duree < limites.minTerm || numerique.duree > limites.maxTerm) {
        e.duree = ta("erreur.plage", { min: ta("mois", { n: limites.minTerm }), max: ta("mois", { n: limites.maxTerm }) });
      }
    }
    if (n === 3 && !accorde.gdpr) e.gdpr = ta("gdpr.requis");
    return e;
  };

  const avancer = () => {
    const e = valider(etape);
    setErreurs(e);
    if (Object.values(e).some(Boolean)) return;
    const suivant = Math.min(ETAPES.length - 1, etape + 1);
    setEtape(suivant);
    allerA(suivant);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reculer = () => {
    const precedent = Math.max(0, etape - 1);
    setErreurs({});
    setEtape(precedent);
    allerA(precedent);
  };

  const soumettre = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = valider(3);
    const cumul = { ...valider(0), ...valider(1), ...valider(2), ...e };
    setErreurs(cumul);
    if (Object.values(cumul).some(Boolean)) {
      const premier = [0, 1, 2, 3].find((n) => Object.values(valider(n)).some(Boolean));
      if (typeof premier === "number") { setEtape(premier); allerA(premier); }
      return;
    }
    setEncours(true);
    if (!isAuthenticated) {
      const inscrit = await sInscrire({
        prenom: champs.prenom ?? "", nom: champs.nom ?? "", email: champs.email ?? "", motDePasse: mdp,
        telephone: champs.telephone, locale, accepteGdpr: accorde.gdpr,
      });
      if (!inscrit.ok) {
        setEncours(false);
        setErreurs(inscrit.code === "EXISTS" ? { email: ta("erreur.emailPris") } : { [inscrit.champ ?? "email"]: ta("erreur.champRequis") });
        setEtape(0);
        return;
      }
      login(inscrit.user, inscrit.accessToken);
    }
    const ref = referenceDossier();
    deposer({
      reference: ref,
      simulation: simulation ? { ...simulation, montant: numerique.montant, duree: numerique.duree, revenu: numerique.revenu, charges: numerique.charges, credits: numerique.credits, produit: choix.produit, objet: choix.objet, statut: choix.statut, typeRevenu: choix.typeRevenu, mensualite: recalcule.r?.simulation.monthlyPayment ?? 0, taeg: recalcule.r?.simulation.taeg ?? 0, interets: recalcule.r?.simulation.totalInterest ?? 0, coutTotal: recalcule.r?.simulation.totalCost ?? 0, score: recalcule.r?.score.value ?? 0, grade: recalcule.r?.score.grade ?? "-", recommandation: recalcule.r?.recommendation ?? "REVIEW_RECOMMENDATION" } : null,
      champs,
    });
    setReference(ref);
    setEncours(false);
  };

  const nbErreurs = Object.values(erreurs).filter(Boolean).length;
  const progression = (Math.min(etape + 1, ETAPES.length) / ETAPES.length);

  if (reference) {
    return (
      <div className="bg-white rounded-[24px] shadow-soft border p-8 md:p-10 text-center">
        <Reveal as="div" variant="scale">
          <svg viewBox="0 0 52 52" className="trace-check w-16 h-16 mx-auto" aria-hidden="true">
            <circle cx="26" cy="26" r="24" fill="none" stroke="#10B981" strokeWidth="2.5" pathLength={1} />
            <path fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" d="M14 27l8 8 16-16" pathLength={1} />
          </svg>
          <h2 className="mt-5 font-display font-extrabold text-[24px] text-ink">{ta("demande.depose")}</h2>
          <p className="mt-2 text-sm text-slate-600">{ta("demande.reference", { ref: reference })}</p>
          <p className="mt-1 text-[13px] text-slate-500 max-w-[520px] mx-auto">{ta("demande.delai")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={`/${locale}/dashboard`} className={buttonClasses("primary", "md", "gap-2")}>
              {ta("cta.entrer")} <ArrowRight className="w-4 h-4" />
            </Link>
            <button type="button" onClick={() => { vider(); setReference(null); }} className={buttonClasses("outline-light", "md", "gap-2")}>
              <Calculator className="w-4 h-4" /> {ta("demande.modifier")}
            </button>
          </div>
          <p className="mt-6 text-[11px] text-slate-400 max-w-[560px] mx-auto">{ta("contrat.note")}</p>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[24px] shadow-soft border overflow-hidden">
      <div className="px-6 md:px-8 py-6 border-b bg-surface/60">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-extrabold text-[22px] text-ink">{ta("demande.titre")}</h2>
            <p className="mt-1 text-sm text-slate-500 max-w-[560px]">{ta("demande.subtitle")}</p>
          </div>
          {simulation ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold tracking-wide text-emerald-700">
              <BadgeCheck className="w-3.5 h-3.5" /> {ta("reprise.bandeau")}
            </span>
          ) : (
            <Link href={`/${locale}#simulateur`} className={buttonClasses("outline-light", "sm", "gap-1.5")}>
              <Calculator className="w-3.5 h-3.5" /> {tr("simulator.title")}
            </Link>
          )}
        </div>

        <ol className="mt-5 grid sm:grid-cols-4 gap-2" aria-label={ta("etape.titre", { n: etape + 1 })}>
          {ETAPES.map((cle, i) => (
            <li key={cle}>
              <button
                type="button"
                onClick={() => { if (i < etape) { setEtape(i); allerA(i); } }}
                className={cn(
                  "w-full text-left rounded-xl border px-3 py-2 transition",
                  i === etape ? "bg-ink text-white border-ink" : i < etape ? "bg-white text-ink border-slate-200 hover:border-ink/25" : "bg-white/60 text-slate-400 border-slate-100",
                  i > etape ? "cursor-default" : "cursor-pointer",
                )}
              >
                <span className="block text-[10px] font-bold tracking-widest uppercase opacity-70">{i + 1}</span>
                <span className="block text-[12px] font-bold leading-4">{ta(cle)}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-3 h-1 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full w-full origin-left barre rounded-full bg-primary" style={{ "--p": progression } as React.CSSProperties} />
        </div>
      </div>

      <form onSubmit={soumettre} className="grid lg:grid-cols-5 gap-0">
        <div className="lg:col-span-3 p-6 md:p-8 space-y-5">
          {nbErreurs > 0 ? (
            <p role="alert" className="secoue flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              {nbErreurs === 1 ? ta("erreur.etapeSeule") : ta("erreur.etapeDeux", { n: nbErreurs })}
            </p>
          ) : null}

          {etape === 0 ? (
            <Reveal as="div" key="etape-0" variant="up" className="grid sm:grid-cols-2 gap-3">
              {isAuthenticated ? (
                <p className="sm:col-span-2 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[12px] font-bold text-emerald-800">
                  <Lock className="w-3.5 h-3.5" /> {ta("demande.dejaConnecte")} — {user?.firstName} {user?.lastName}
                </p>
              ) : (
                <>
                  <Champ ta={ta} label="champ.prenom" valeur={champs.prenom ?? ""} onChange={maj("prenom")} erreur={erreurs.prenom} autoComplete="given-name" />
                  <Champ ta={ta} label="champ.nom" valeur={champs.nom ?? ""} onChange={maj("nom")} erreur={erreurs.nom} autoComplete="family-name" />
                  <div className="sm:col-span-2">
                    <Champ ta={ta} label="champ.email" valeur={champs.email ?? ""} onChange={maj("email")} erreur={erreurs.email} type="email" autoComplete="email" />
                  </div>
                  <Champ ta={ta} label="champ.motDePasse" valeur={mdp} onChange={(e) => { setMdp(e.target.value); setErreurs((x) => ({ ...x, motDePasse: undefined })); }} erreur={erreurs.motDePasse} type="password" autoComplete="new-password" aide="aide.motDePasse" />
                  <Champ ta={ta} label="champ.confirmation" valeur={mdp2} onChange={(e) => { setMdp2(e.target.value); setErreurs((x) => ({ ...x, confirmation: undefined })); }} erreur={erreurs.confirmation} type="password" autoComplete="new-password" />
                  <div className="sm:col-span-2">
                    <Champ ta={ta} label="champ.telephone" valeur={champs.telephone ?? ""} onChange={maj("telephone")} erreur={erreurs.telephone} type="tel" autoComplete="tel" aide="aide.telephone" />
                  </div>
                </>
              )}
            </Reveal>
          ) : null}

          {etape === 1 ? (
            <Reveal as="div" key="etape-1" variant="up" className="grid sm:grid-cols-2 gap-3">
              <Champ ta={ta} label="champ.naissance" valeur={champs.naissance ?? ""} onChange={maj("naissance")} erreur={erreurs.naissance} type="date" autoComplete="bday" />
              <Champ ta={ta} label="champ.nationalite" valeur={champs.nationalite ?? ""} onChange={maj("nationalite")} />
              <div className="champ" data-invalide={erreurs.situationFamiliale ? "true" : "false"}>
                <select value={champs.situationFamiliale ?? ""} onChange={maj("situationFamiliale")}>
                  <option value="">{ta("choisir")}</option>
                  {FOYER.map((c) => <option key={c} value={c}>{ta("foyer." + c)}</option>)}
                </select>
                <label>{ta("champ.situationFamiliale")}</label>
              </div>
              <Champ ta={ta} label="champ.personnes" valeur={champs.personnes ?? ""} onChange={maj("personnes")} type="number" aide="champ.personnes.aide" />
              <div className="champ">
                <select value={choix.statut} onChange={(e) => setChoix((c) => ({ ...c, statut: e.target.value }))}>
                  {EMPLOYMENT_STATUSES.map((code) => <option key={code} value={code}>{tr(`simulator.employment.${code}`)}</option>)}
                </select>
                <label>{ta("champ.emploi")}</label>
              </div>
              <div className="champ">
                <select value={choix.typeRevenu} onChange={(e) => setChoix((c) => ({ ...c, typeRevenu: e.target.value }))}>
                  {INCOME_TYPES.map((code) => <option key={code} value={code}>{tr(`simulator.incomeType.${code}`)}</option>)}
                </select>
                <label>{ta("champ.typeRevenu")}</label>
              </div>
              <Champ ta={ta} label="champ.revenu" valeur={String(numerique.revenu)} onChange={majNb("revenu")} erreur={erreurs.revenu} type="number" />
              <Champ ta={ta} label="champ.charges" valeur={String(numerique.charges)} onChange={majNb("charges")} type="number" />
              <div className="sm:col-span-2">
                <Champ ta={ta} label="champ.credits" valeur={String(numerique.credits)} onChange={majNb("credits")} type="number" />
              </div>
              <div className="sm:col-span-2 grid sm:grid-cols-3 gap-3">
                <Champ ta={ta} label="champ.adresse" valeur={champs.adresse ?? ""} onChange={maj("adresse")} />
                <Champ ta={ta} label="champ.codePostal" valeur={champs.codePostal ?? ""} onChange={maj("codePostal")} />
                <Champ ta={ta} label="champ.ville" valeur={champs.ville ?? ""} onChange={maj("ville")} />
              </div>
            </Reveal>
          ) : null}

          {etape === 2 ? (
            <Reveal as="div" key="etape-2" variant="up" className="grid sm:grid-cols-2 gap-3">
              <div className="champ">
                <select value={choix.produit} onChange={(e) => {
                  const produit = e.target.value as ProductCode;
                  const p = PRODUITS[produit];
                  setChoix((c) => ({ ...c, produit }));
                  // Changer de produit change la fourchette: on re-quantifie au lieu de laisser un
                  // montant hors grille (c'est exactement ce que faisait l'ancien onglet du simulateur).
                  setNumerique((v) => ({
                    ...v,
                    montant: Math.min(p.max, Math.max(p.min, Math.round(v.montant / p.pas) * p.pas)),
                    duree: Math.min(p.maxTerm, Math.max(p.minTerm, v.duree)),
                  }));
                }}>
                  {PRODUCT_TYPES.map((code) => <option key={code} value={code}>{tr(`simulator.tab.${code}`)}</option>)}
                </select>
                <label>{ta("champ.objet")}</label>
              </div>
              <div className="champ">
                <select value={choix.objet} onChange={(e) => setChoix((c) => ({ ...c, objet: e.target.value }))}>
                  {LOAN_PURPOSES.map((code) => <option key={code} value={code}>{tr(`simulator.purpose.${code}`)}</option>)}
                </select>
                <label>{tr("simulator.purposeLabel")}</label>
              </div>
              <Champ ta={ta} label="champ.montant" valeur={String(numerique.montant)} onChange={majNb("montant")} erreur={erreurs.montant} type="number" aide="documents.deja" />
              <Champ ta={ta} label="champ.duree" valeur={String(numerique.duree)} onChange={majNb("duree")} erreur={erreurs.duree} type="number" />
            </Reveal>
          ) : null}

          {etape === 3 ? (
            <Reveal as="div" key="etape-3" variant="up" className="space-y-4">
              <div className="rounded-2xl border bg-surface p-4">
                <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-slate-500">
                  <FileCheck className="w-4 h-4 text-primary" /> {ta("documents.titre")}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-slate-600">{ta("documents.aide")}</p>
              </div>
              <label className={cn("flex gap-3 rounded-2xl border p-4 cursor-pointer transition", erreurs.gdpr ? "border-red-200 bg-red-50" : "border-slate-200 hover:border-ink/20")}>
                <input type="checkbox" checked={accorde.gdpr} onChange={(e) => { setAccorde((a) => ({ ...a, gdpr: e.target.checked })); setErreurs((x) => ({ ...x, gdpr: undefined })); }} className="mt-0.5 accent-[#FF4A17]" />
                <span className="text-[13px] leading-6 text-slate-700">{ta("gdpr")}</span>
              </label>
              {erreurs.gdpr ? <p className="text-[11px] font-bold text-red-600">{erreurs.gdpr}</p> : null}
              <label className="flex gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer transition hover:border-ink/20">
                <input type="checkbox" checked={accorde.offre} onChange={(e) => setAccorde((a) => ({ ...a, offre: e.target.checked }))} className="mt-0.5 accent-[#FF4A17]" />
                <span className="text-[13px] leading-6 text-slate-700">{ta("offre")}</span>
              </label>
              <p className="text-[11px] leading-5 text-slate-400">{ta("contrat.note")}</p>
            </Reveal>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {etape > 0 ? (
              <button type="button" onClick={reculer} className={buttonClasses("outline-light", "md", "gap-2")}>
                <ArrowLeft className="w-4 h-4" /> {ta("demande.reculer")}
              </button>
            ) : null}
            {etape < ETAPES.length - 1 ? (
              <button type="button" onClick={avancer} className={buttonClasses("primary", "md", "gap-2")}>
                {ta("demande.avancer")} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={encours} className={buttonClasses("primary", "md", cn("gap-2", encours && "opacity-70"))}>
                {encours ? ta("erreur.encours") : ta("demande.deposer")}
                {encours ? null : <Wallet className="w-4 h-4" />}
              </button>
            )}
            <span className="ml-auto text-[11px] font-bold tracking-widest uppercase text-slate-400">
              {ta("etape.titre", { n: etape + 1 })}
            </span>
          </div>
        </div>

        {/* Le récapitulatif: vivant, calculé sur l'état du formulaire, pas figé à la simulation d'hier. */}
        <aside className="lg:col-span-2 bg-ink text-white p-6 md:p-8 relative overflow-hidden">
          <div className="maillage" aria-hidden="true" />
          <div className="relative">
            <div className="text-[11px] font-bold tracking-widest uppercase text-primary">{ta("demande.recap")}</div>
            {recalcule.r ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-white/45">{tr("simulator.monthly")}</div>
                  <div className="text-[30px] font-extrabold leading-tight tabular-nums">{formatEUR2(recalcule.r.simulation.monthlyPayment, locale)}</div>
                  <div className="text-[11px] text-white/45">{tr("simulator.perMonth")} • {tr(`simulator.tab.${choix.produit}`)}</div>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-[13px]">
                  {[
                    [tr("simulator.amount"), formatEUR(numerique.montant, locale)],
                    [tr("simulator.term"), ta("mois", { n: numerique.duree })],
                    [tr("simulator.taeg"), formatPercent(recalcule.r.simulation.taeg, locale, 2)],
                    [tr("simulator.total"), formatEUR(recalcule.r.simulation.totalCost, locale)],
                  ].map(([libelle, valeur]) => (
                    <div key={String(libelle)} className="rounded-xl bg-white/[0.06] border border-white/10 p-3">
                      <dt className="text-[10px] uppercase tracking-widest text-white/45">{libelle}</dt>
                      <dd className="mt-1 font-extrabold tabular-nums">{valeur}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-xl bg-white/[0.06] border border-white/10 p-3">
                  <div className="flex items-center justify-between text-[13px] font-bold">
                    <span>{tr("simulator.score")}</span>
                    <span className="tabular-nums">{recalcule.r.score.value} · {recalcule.r.score.grade}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div className="h-full w-full origin-left barre rounded-full bg-emerald-400" style={{ "--p": String(recalcule.r.score.value / 100) } as React.CSSProperties} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-[13px] leading-6 text-white/70">{recalcule.erreur || ta("erreur.plage", { min: formatMontantCompact(limites.min, locale), max: formatMontantCompact(limites.max, locale) })}</p>
            )}
            <p className="mt-5 text-[11px] leading-5 text-white/45 border-l-2 border-primary/50 pl-3">{ta("demande.recapNote")}</p>
          </div>
        </aside>
      </form>
    </div>
  );
}

/** Champ à étiquette flottante: l'étiquette monte au focus OU quand une valeur est saisie (CSS pur). */
function Champ({ ta, label, valeur, onChange, erreur, type = "text", autoComplete, aide }: {
  ta: (cle: string, vars?: Record<string, any>) => string;
  label: string; valeur: string; onChange: (e: any) => void; erreur?: string;
  type?: string; autoComplete?: string; aide?: string;
}) {
  // L'aide se construit avant le JSX: enchaîner deux ternaires *entre deux balises* fait lire
  // « : aide ? » comme un nœud texte par le garde-fou de copie — un faux positif, mais le markup reste
  // plus lisible avec un nœud nommé qu'avec deux conditions collées.
  const aideNode = erreur ? (
    <span className="aide-champ" data-role="erreur">{erreur}</span>
  ) : aide ? (
    <span className="aide-champ">{ta(aide)}</span>
  ) : null;

  return (
    <div className="champ" data-invalide={erreur ? "true" : "false"}>
      <input type={type} value={valeur} onChange={onChange} placeholder=" " autoComplete={autoComplete} />
      <label>{ta(label)}</label>
      {aideNode}
    </div>
  );
}
