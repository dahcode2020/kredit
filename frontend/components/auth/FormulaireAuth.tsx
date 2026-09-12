"use client";
/**
 * L'écran du portail client — connexion, inscription, et le même écran pour l'admin et le super admin.
 *
 * Trois intentions de design, écrites parce qu'elles ont chacune coûté une révision :
 *
 * 1. **Un seul écran pour les trois rôles**, mais le rôle n'est jamais *choisi* comme un droit : la
 *    puce « Client / Administrateur / Super administrateur » sert à présélectionner le compte de
 *    démonstration et à annoncer le second facteur. Le rôle réellement accordé vient du compte trouvé
 *    par le service (`roleAttendu` n'est qu'une indice affiché). Un sélecteur qui ouvrirait le
 *    back-office serait un bouton « devenir admin ».
 * 2. **Le second facteur est une étape, pas une option** : `seConnecter` renvoie `mfaRequis`, et tant
 *    que ce n'est pas passé, rien n'est écrit dans le store de session. La page ne décide pas.
 * 3. **L'inscription n'est pas un tunnel** : trois champs, un consentement, et on ouvre l'espace. La
 *    demande de crédit détaillée vit dans `/demande`, pré-remplie par la simulation — c'est là que les
 *    douze questions ont un sens (elles expliquent un montant), pas ici (elles n'expliquent rien).
 *
 * Hydratation : aucun `localStorage`, aucune valeur de store lue au render. L'intention venue de la
 * page d'accueil (rôle, compte de démo, mode) est appliquée en `useEffect`, donc le premier rendu
 * client est identique au HTML servi et le correctif de grille d'hydratation de ce dépôt tient.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, BadgeCheck, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, Sparkles } from "lucide-react";
import Mascotte from "@/components/auth/Mascotte";
import Reveal from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useDemandeHydratee } from "@/hooks/useDemande";
import { usePortail } from "@/hooks/usePortail";
import {
  CODE_DEMO, COMPTES_DEMO, codeMfaValide, forceDuMotDePasse, roleAttendu, sInscrire, seConnecter,
  type Role,
} from "@/lib/auth-service";
import { Locale, t, tNs } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Mode = "connexion" | "inscription";
type Champs = {
  email: string; motDePasse: string; confirmation: string;
  prenom: string; nom: string; telephone: string;
};
const VIDES: Champs = { email: "", motDePasse: "", confirmation: "", prenom: "", nom: "", telephone: "" };

/** Destination après connexion: un seul endroit pour que le rôle décide, ici et pas en quatre pages. */
export function hrefSelonRole(locale: Locale, role: Role) {
  if (role === "SUPER_ADMIN") return `/${locale}/super`;
  if (role === "ADMIN") return `/${locale}/admin/dashboard`;
  return `/${locale}/dashboard`;
}

const LIBELLES_ROLE: Record<Role, string> = { CUSTOMER: "role.client", ADMIN: "role.admin", SUPER_ADMIN: "role.super" };

export default function FormulaireAuth({ locale }: { locale: Locale }) {
  const ta = useCallback((cle: string, vars?: Record<string, any>) => tNs(locale, "auth", cle, vars), [locale]);
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const intent = usePortail();
  const { simulation } = useDemandeHydratee();

  const [mode, setMode] = useState<Mode>("connexion");
  const [champs, setChamps] = useState<Champs>(VIDES);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Champs | "code" | "gdpr", string>>>({});
  const [gdpr, setGdpr] = useState(false);
  const [encours, setEncours] = useState(false);
  const [secousse, setSecousse] = useState(0);
  const [mfa, setMfa] = useState<{ user: any; accessToken: string } | null>(null);
  const [code, setCode] = useState("");
  const [oubli, setOubli] = useState(false);
  const [voirMdp, setVoirMdp] = useState(false);
  const [reussi, setReussi] = useState<string | null>(null);
  const champRef = useRef<HTMLInputElement | null>(null);

  // L'intention de la page d'accueil est appliquée APRÈS le premier rendu (voir l'en-tête du fichier).
  useEffect(() => {
    if (intent.motivation === "inscription") setMode("inscription");
    if (intent.email) setChamps((c) => ({ ...c, email: intent.email }));
    if (intent.motDePasseDemo) setChamps((c) => ({ ...c, motDePasse: intent.motDePasseDemo }));
    // Une seule lecture d'intention par montage: `oublier()` remet le store à zéro juste après.
    intent.oublier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const force = forceDuMotDePasse(champs.motDePasse);
  const libelleForce = [ta("force.faible"), ta("force.faible"), ta("force.moyenne"), ta("force.bonne"), ta("force.excellente")][force];
  const moral: "serein" | "content" | "attentif" = reussi ? "content" : Object.keys(erreurs).length ? "attentif" : "serein";
  const roleChoisi = intent.role;
  const roleDevine = roleAttendu(champs.email);
  const ecartRole = champs.email.length > 3 && roleDevine !== roleChoisi;

  const remplirDemo = (email: string, motDePasse: string) => {
    setMode("connexion");
    setChamps({ ...VIDES, email, motDePasse });
    setErreurs({});
    setMfa(null);
    setReussi(null);
  };

  const maj = (cle: keyof Champs) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setChamps((c) => ({ ...c, [cle]: e.target.value }));
    setErreurs((err) => (err[cle] ? { ...err, [cle]: undefined } : err));
  };

  const echouer = (champ: Partial<typeof erreurs>) => {
    setErreurs(champ);
    setSecousse((n) => n + 1); // la classe .secoue se rejoue par changement de clé
  };

  const ouvrir = (user: any, accessToken: string) => {
    login(user, accessToken);
    setReussi(user.firstName || user.email);
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (encours || mfa) return;

    if (mode === "inscription") {
      if (!champs.prenom.trim() || !champs.nom.trim() || !champs.email.trim() || !champs.motDePasse) {
        return echouer({
          prenom: champs.prenom.trim() ? undefined : ta("erreur.champRequis"),
          nom: champs.nom.trim() ? undefined : ta("erreur.champRequis"),
          email: champs.email.trim() ? undefined : ta("erreur.champRequis"),
          motDePasse: champs.motDePasse ? undefined : ta("erreur.champRequis"),
        });
      }
      if (champs.motDePasse !== champs.confirmation) return echouer({ confirmation: ta("erreur.confirmation") });
      if (!gdpr) return echouer({ gdpr: ta("gdpr.requis") });
      setEncours(true);
      const res = await sInscrire({
        prenom: champs.prenom, nom: champs.nom, email: champs.email, motDePasse: champs.motDePasse,
        telephone: champs.telephone, locale, accepteGdpr: gdpr,
      });
      setEncours(false);
      if (!res.ok) {
        if (res.code === "EXISTS") return echouer({ email: ta("erreur.emailPris") });
        const cle = res.champ === "motDePasse" ? "erreur.motDePasse" : res.champ === "telephone" ? "erreur.telephone" : res.champ === "gdpr" ? "gdpr.requis" : "erreur.champRequis";
        return echouer({ [res.champ ?? "email"]: ta(cle) });
      }
      ouvrir(res.user, res.accessToken);
      return;
    }

    setEncours(true);
    const res = await seConnecter({ email: champs.email, motDePasse: champs.motDePasse, locale });
    setEncours(false);
    if (!res.ok) {
      if (res.code === "CHAMP") return echouer({ [res.champ ?? "email"]: ta(res.champ === "motDePasse" ? "erreur.champRequis" : "erreur.email") });
      return echouer({ email: ta("error.invalidCredentials"), motDePasse: ta("error.invalidCredentials") });
    }
    if (res.mfaRequis) {
      setMfa({ user: res.user, accessToken: res.accessToken });
      setCode("");
      setTimeout(() => champRef.current?.focus(), 40);
      return;
    }
    ouvrir(res.user, res.accessToken);
  };

  const validerCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeMfaValide(code) || code !== CODE_DEMO) return echouer({ code: ta("erreur.code") });
    if (!mfa) return;
    ouvrir(mfa.user, mfa.accessToken);
  };

  // Redirection après le petit moment de succès: 900 ms, pas plus — un écran qui « félicite » deux
  // secondes avant de bouger donne l'impression que l'application est lente.
  useEffect(() => {
    if (!reussi) return;
    const cible = hrefSelonRole(locale, mfa?.user?.role ?? (champs.email ? roleAttendu(champs.email) : "CUSTOMER"));
    const t1 = setTimeout(() => router.push(cible), 900);
    return () => clearTimeout(t1);
  }, [reussi, router, locale, mfa, champs.email]);

  const comptesFiltres = useMemo(
    () => COMPTES_DEMO.filter((c) => c.role === roleChoisi || roleChoisi === "CUSTOMER"),
    [roleChoisi],
  );

  return (
    <div className="grid lg:grid-cols-2 gap-0 bg-white rounded-[28px] overflow-hidden shadow-card border border-black/5">
      {/* ---- Colonne de gauche: le visage ---- */}
      <div className="relative bg-ink text-white px-8 py-10 lg:py-12 overflow-hidden">
        <div className="maillage" aria-hidden="true" />
        <div className="relative">
          <Reveal as="div" variant="fade">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] tracking-widest uppercase font-bold">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> {ta("subtitle")}
            </span>
          </Reveal>
          <Reveal as="h1" retard={70} className="mt-5 font-display font-extrabold text-[30px] md:text-[36px] leading-[1.05] tracking-tight">
            {ta("title")}
          </Reveal>
          <Reveal as="p" retard={140} className="mt-3 text-sm leading-6 text-white/70 max-w-[420px]">
            {mode === "connexion" ? ta("aide.connexion") : ta("aide.inscription")}
          </Reveal>

          <Reveal as="div" retard={220} pas={26} className="mt-8 hidden lg:block">
            <Mascotte moral={moral} />
          </Reveal>

          <ul className="mt-8 space-y-3">
            {["securite.1", "securite.2", "securite.3"].map((cle, i) => (
              <Reveal as="li" key={cle} retard={280 + i * 70} variant="left" className="flex gap-3 text-[13px] text-white/70">
                <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                <span>{ta(cle)}</span>
              </Reveal>
            ))}
          </ul>

          <div className="mt-9 rounded-2xl bg-white/[0.06] border border-white/10 p-4">
            <div className="text-[11px] font-bold tracking-widest uppercase text-white/50">{ta("comptes.titre")}</div>
            <p className="mt-1 text-[11px] leading-5 text-white/45">{ta("comptes.aide")}</p>
            <div className="mt-3 grid gap-2">
              {comptesFiltres.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => remplirDemo(c.email, c.motDePasse)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition active:scale-[.99] hover:bg-white/[0.09]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-white">{c.email}</span>
                    <span className="block text-[11px] text-white/45">{ta(LIBELLES_ROLE[c.role])}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/25">
                    {ta("onglet.connexion")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Colonne de droite: la saisie ---- */}
      <div className="px-6 py-8 md:px-10 md:py-10">
        <div
          key={secousse}
          className={cn("bg-white rounded-[22px]", secousse > 0 && Object.keys(erreurs).length ? "secoue" : undefined)}
        >
          {mfa ? (
            <form onSubmit={validerCode} className="space-y-4">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-primary">
                <Lock className="w-3.5 h-3.5" /> {ta("mfa.title")}
              </div>
              <p className="text-sm text-slate-500">{ta("mfa.aide")}</p>
              <div className="champ" data-invalide={erreurs.code ? "true" : "false"}>
                <input
                  ref={champRef as any}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setErreurs({}); }}
                  placeholder=" "
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={ta("mfa.code")}
                  className="tracking-[0.5em] text-center font-extrabold text-[20px]"
                />
                <label>{ta("mfa.code")}</label>
                {erreurs.code ? <span className="aide-champ" data-role="erreur">{erreurs.code}</span> : null}
              </div>
              <button type="submit" className={buttonClasses("primary", "lg", "w-full gap-2")}>
                {ta("mfa.verify")} <ArrowRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => { setMfa(null); setCode(""); setErreurs({}); }} className="w-full text-[12px] font-bold text-slate-500 hover:text-ink transition">
                {ta("demande.reculer")}
              </button>
            </form>
          ) : reussi ? (
            <div className="py-6 text-center">
              <svg viewBox="0 0 52 52" className="trace-check w-14 h-14 mx-auto" aria-hidden="true">
                <circle cx="26" cy="26" r="24" fill="none" stroke="#10B981" strokeWidth="2.5" pathLength={1} />
                <path fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" d="M14 27l8 8 16-16" pathLength={1} />
              </svg>
              <p className="mt-4 text-[15px] font-extrabold text-ink">{ta(mode === "inscription" ? "ok.inscription" : "ok.connexion", { prenom: reussi })}</p>
              <p className="mt-1 text-xs text-slate-500">{ta("cta.entrer")}…</p>
            </div>
          ) : (
            <form onSubmit={soumettre} className="space-y-4">
              <div className="pastilles" data-sombre="false" style={{ "--i": mode === "connexion" ? 0 : 1, "--nb": 2 } as React.CSSProperties} role="tablist">
                <span className="pastille" aria-hidden="true" />
                {(["connexion", "inscription"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    data-role="pastille"
                    aria-selected={mode === m}
                    onClick={() => { setMode(m); setErreurs({}); }}
                  >
                    {ta(m === "connexion" ? "onglet.connexion" : "onglet.inscription")}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5" role="group" aria-label={ta("role.titre")}>
                <span className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{ta("role.titre")}</span>
                <div className="flex gap-1 ml-auto">
                  {(Object.keys(LIBELLES_ROLE) as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => intent.choisirRole(r)}
                      className={cn(
                        "h-7 px-2.5 rounded-full text-[10px] font-bold tracking-wide uppercase border transition active:scale-[.97]",
                        roleChoisi === r ? "bg-ink text-white border-ink" : "bg-white text-slate-500 border-slate-200 hover:border-ink/25",
                      )}
                    >
                      {ta(LIBELLES_ROLE[r])}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] leading-4 text-slate-400">{ta("role.aide")}</p>
              {ecartRole ? (
                <p className="flex gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {ta("role.aide")}
                </p>
              ) : null}

              {mode === "inscription" ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="champ" data-invalide={erreurs.prenom ? "true" : "false"}>
                    <input value={champs.prenom} onChange={maj("prenom")} placeholder=" " autoComplete="given-name" />
                    <label>{ta("champ.prenom")}</label>
                    {erreurs.prenom ? <span className="aide-champ" data-role="erreur">{erreurs.prenom}</span> : null}
                  </div>
                  <div className="champ" data-invalide={erreurs.nom ? "true" : "false"}>
                    <input value={champs.nom} onChange={maj("nom")} placeholder=" " autoComplete="family-name" />
                    <label>{ta("champ.nom")}</label>
                    {erreurs.nom ? <span className="aide-champ" data-role="erreur">{erreurs.nom}</span> : null}
                  </div>
                </div>
              ) : null}

              <div className="champ" data-invalide={erreurs.email ? "true" : "false"}>
                <input value={champs.email} onChange={maj("email")} placeholder=" " type="email" autoComplete="email" className="pr-11" />
                <label>{ta("champ.email")}</label>
                <Mail className="w-4 h-4 text-slate-300 absolute right-3.5 top-[18px] pointer-events-none" />
                {erreurs.email ? <span className="aide-champ" data-role="erreur">{erreurs.email}</span> : null}
              </div>

              <div className="champ" data-invalide={erreurs.motDePasse ? "true" : "false"}>
                <input value={champs.motDePasse} onChange={maj("motDePasse")} placeholder=" " type={voirMdp ? "text" : "password"} autoComplete={mode === "connexion" ? "current-password" : "new-password"} className="pr-12" />
                <label>{ta("champ.motDePasse")}</label>
                <button type="button" className="oeil" onClick={() => setVoirMdp((v) => !v)} aria-label={voirMdp ? "masquer" : "afficher"}>
                  {voirMdp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {mode === "inscription" ? (
                  <>
                    <div className="jauge" data-n={force} aria-hidden="true"><i /><i /><i /><i /></div>
                    <span className="aide-champ">{libelleForce} — {ta("aide.motDePasse")}</span>
                  </>
                ) : null}
                {erreurs.motDePasse ? <span className="aide-champ" data-role="erreur">{erreurs.motDePasse}</span> : null}
              </div>

              {mode === "inscription" ? (
                <>
                  <div className="champ" data-invalide={erreurs.confirmation ? "true" : "false"}>
                    <input value={champs.confirmation} onChange={maj("confirmation")} placeholder=" " type="password" autoComplete="new-password" />
                    <label>{ta("champ.confirmation")}</label>
                    {erreurs.confirmation ? <span className="aide-champ" data-role="erreur">{erreurs.confirmation}</span> : null}
                  </div>
                  <div className="champ" data-invalide={erreurs.telephone ? "true" : "false"}>
                    <input value={champs.telephone} onChange={maj("telephone")} placeholder=" " type="tel" autoComplete="tel" className="pr-11" />
                    <label>{ta("champ.telephone")}</label>
                    <Phone className="w-4 h-4 text-slate-300 absolute right-3.5 top-[18px] pointer-events-none" />
                    {erreurs.telephone ? <span className="aide-champ" data-role="erreur">{erreurs.telephone}</span> : <span className="aide-champ">{ta("aide.telephone")}</span>}
                  </div>
                  <label className="flex gap-2.5 items-start text-[12px] leading-5 text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={gdpr} onChange={(e) => { setGdpr(e.target.checked); setErreurs((x) => ({ ...x, gdpr: undefined })); }} className="mt-0.5 accent-[#FF4A17]" />
                    <span>{ta("gdpr")}</span>
                  </label>
                  {erreurs.gdpr ? <span className="aide-champ" data-role="erreur">{erreurs.gdpr}</span> : null}
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-500 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#FF4A17]" /> {ta("remember")}
                  </label>
                  <button type="button" onClick={() => setOubli((v) => !v)} className="text-[12px] font-bold text-primary hover:underline">
                    {ta("forgot")}
                  </button>
                </div>
              )}
              {oubli && mode === "connexion" ? (
                <p className="text-[11px] leading-4 text-slate-500 bg-surface border rounded-xl px-3 py-2">{ta("oublier.note")}</p>
              ) : null}

              {simulation && mode === "inscription" ? (
                <Link
                  href={`/${locale}/demande`}
                  className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] px-3.5 py-3 transition hover:bg-primary/[0.1]"
                >
                  <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-extrabold text-ink">{ta("demande.reprise")}</span>
                    <span className="block text-[11px] text-slate-500">{ta("demande.titre")}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 text-primary ml-auto shrink-0" />
                </Link>
              ) : null}

              <button type="submit" disabled={encours} className={buttonClasses("primary", "lg", cn("w-full gap-2", encours && "opacity-70"))}>
                {encours ? ta("erreur.encours") : ta(mode === "connexion" ? "login.cta" : "register.cta")}
                {encours ? null : <ArrowRight className="w-4 h-4" />}
              </button>

              <p className="text-center text-[12px] text-slate-500">
                {ta(mode === "connexion" ? "lien.basculer.inscription" : "lien.basculer.connexion")}{" "}
                <button type="button" onClick={() => { setMode(mode === "connexion" ? "inscription" : "connexion"); setErreurs({}); }} className="font-extrabold text-ink hover:underline">
                  {ta(mode === "connexion" ? "onglet.inscription" : "onglet.connexion")}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
