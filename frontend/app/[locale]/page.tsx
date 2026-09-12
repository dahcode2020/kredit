"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge, Button, buttonClasses } from "@/components/ui/Button";
import Simulator from "@/components/credit/Simulator";
import Reveal from "@/components/motion/Reveal";
import CountUp from "@/components/motion/CountUp";
import Parallax from "@/components/motion/Parallax";
import { formatMontantCompact, formatNumber, formatPercent } from "@/lib/formatters";
import { formatEUR2 } from "@/lib/utils";
import { PRODUITS, simulateCredit, tauxMiniProduit } from "@/lib/credit-engine";
import { Locale, t } from "@/lib/i18n";
import { useAuth, useAuthHydrated } from "@/hooks/useAuth";
import { usePortail } from "@/hooks/usePortail";
import { COMPTES_DEMO } from "@/lib/auth-service";
import { tNs } from "@/lib/i18n";
import { Check, Shield, Lock, FileCheck, Clock, Users, TrendingUp, Star, Play, ArrowRight, Award, Building2, Wallet, Home, Briefcase, BarChart3, Fingerprint, Scale, Bell, MessageCircle, Mail, Phone, MapPin, Quote, ChevronDown, Calculator, Info } from "lucide-react";

/**
 * L'exemple de la carte du hero (15 000 € sur 48 mois, revenu 3 200 €, charges 600 €).
 * Calculé par le moteur au lieu d'être tapé: le TAEG, la mensualité et la barre du même bloc
 * sortent du MÊME objet, donc ils ne peuvent plus se contredire quand la grille bouge.
 * Déterministe (aucune horloge dans ce qui est rendu) — identique côté serveur et côté client.
 */
const VITRINE = simulateCredit({
  amount: 15_000, termMonths: 48, monthlyIncome: 3_200, monthlyCharges: 600,
  incomeType: "SALARY", employmentStatus: "CDI", loanPurpose: "VEHICLE",
  existingCreditsMonthly: 0, country: "BE", productType: "PERSONAL",
});

export default function Page({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const tr = (k: string) => t(locale, k);
  const [activeTab, setActiveTab] = useState(0);
  const router = useRouter();
  const { isAuthenticated, user } = useAuthHydrated();
  const choisirRole = usePortail((st) => st.choisirRole);
  const choisirCompteDemo = usePortail((st) => st.choisirCompteDemo);
  const basculerPortail = usePortail((st) => st.basculer);
  /**
   * Le clic sur une carte de rôle ouvrait **une session fabriquée ici** (token aléatoire, utilisateur
   * de toutes pièces) — la page affichait « connecté » sans jamais passer par l'authentification, ce
   * qui rendait l'écran du portail mort pour un visiteur, et faux pour un relecteur.
   * Il ouvre désormais le portail, en y apportant le rôle et le compte de démonstration: le
   * formulaire décide, le service accorde, la page d'accueil ne fait que demander.
   */
  const ouvrirPortail = (role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN") => {
    const compte = COMPTES_DEMO.find((c) => c.role === role);
    choisirRole(role);
    if (compte) choisirCompteDemo(compte.email, compte.motDePasse);
    router.push(`/${locale}/auth`);
  };

  return (
    <div className="bg-white">
      {/* HERO — Dewi style: dark overlay with stats left, image bg */}
      <section className="relative overflow-hidden bg-ink">
        <Parallax amplitude={16} className="absolute -inset-[4%]">
          <Image src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&auto=format&fit=crop&q=80" alt="" fill priority sizes="100vw" className="object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
        </Parallax>

        <div className="relative mx-auto max-w-[1280px] px-6 py-16 md:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <Reveal as="div" variant="fade" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] tracking-widest uppercase font-bold text-white/90 backdrop-blur">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {tr("hero.eyebrow")}
              </Reveal>
              <Reveal as="h1" retard={90} pas={28} className="mt-6 font-display font-extrabold text-white leading-[0.95] tracking-tight text-[42px] md:text-[56px]">
                {tr("hero.title1")} <br />
                <span className="text-white">{tr("hero.title2")}</span> <br />
                <span className="text-primary">{tr("hero.title3")}</span>
              </Reveal>
              <Reveal as="p" retard={170} className="mt-5 text-[15px] leading-7 text-white/70 max-w-[560px]">{tr("hero.subtitle")}</Reveal>

              <Reveal as="div" retard={250} className="mt-8 flex flex-wrap gap-3">
                <Link href="#simulateur" className={buttonClasses("primary", "lg", "gap-2")}>{tr("hero.cta1")} <ArrowRight className="w-4 h-4" /></Link>
                <a href="#about" className="inline-flex items-center gap-3 h-[48px] px-6 rounded-full bg-white text-ink font-bold text-sm hover:bg-white/90 transition"><span className="w-8 h-8 rounded-full bg-ink text-white grid place-items-center"><Play className="w-3.5 h-3.5 ml-0.5" /></span>{tr("hero.cta2")}</a>
              </Reveal>

              <Reveal as="div" retard={330} className="mt-6 flex items-center gap-3 text-[11px] font-semibold tracking-widest uppercase text-white/50">
                <Shield className="w-4 h-4 text-emerald-400" /> {tr("hero.trust")}
              </Reveal>
              <Reveal as="p" retard={400} className="mt-4 text-[11px] leading-5 text-white/45 border-l-2 border-primary/50 pl-3 max-w-[560px]">{tr("hero.disclaimer")}</Reveal>
            </div>

            {/* Right: Simulator hero card preview */}
            <div className="relative">
              <Reveal as="div" variant="left" retard={160} pas={0} spotlight className="bg-white rounded-[24px] shadow-card p-6 md:p-7">
                <div className="flex items-center justify-between">
                  <Badge>{tr("heroCard.badge")}</Badge>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {tr("heroCard.status")}</span>
                </div>
                <h3 className="mt-4 font-extrabold text-ink text-lg">{tr("heroCard.title")}</h3>
                <p className="text-sm text-slate-500">{tr("heroCard.subtitle")}</p>

                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-surface border p-3"><div className="text-[11px] font-bold tracking-widest uppercase text-slate-500">{tr("heroCard.from")}</div><div className="font-extrabold text-ink">{formatPercent(VITRINE.simulation.taeg, locale, 2)}</div><div className="text-[11px] text-slate-400">TAEG</div></div>
                  <div className="rounded-2xl bg-surface border p-3"><div className="text-[11px] font-bold tracking-widest uppercase text-slate-500">{tr("heroCard.upTo")}</div><div className="font-extrabold text-ink">{formatMontantCompact(PRODUITS.MORTGAGE.max, locale)}</div><div className="text-[11px] text-slate-400">{tr("heroCard.upToSub")}</div></div>
                  <div className="rounded-2xl bg-surface border p-3"><div className="text-[11px] font-bold tracking-widest uppercase text-slate-500">{tr("heroCard.reply")}</div><div className="font-extrabold text-ink">&lt;24h</div><div className="text-[11px] text-slate-400">{tr("heroCard.replySub")}</div></div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">{tr("heroCard.example")}</span><span className="font-bold text-ink">{formatEUR2(VITRINE.simulation.monthlyPayment, locale)} {tr("simulator.perMonth")}</span></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-full origin-left barre bg-primary rounded-full" style={{ "--p": String(Math.min(1, VITRINE.eligibility.debtRatio)) } as React.CSSProperties} /></div>
                  <p className="text-[11px] text-slate-400">{tr("heroCard.note")}</p>
                </div>

                <Link href="#simulateur" className="mt-5 flex items-center justify-center gap-2 h-11 rounded-full bg-ink text-white font-bold text-sm hover:bg-ink-light transition">{tr("heroCard.cta")} <ArrowRight className="w-4 h-4" /></Link>
                <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-400"><span className="flex items-center gap-1"><Lock className="w-3 h-3" /> RGPD</span><span className="flex items-center gap-1"><FileCheck className="w-3 h-3" /> eIDAS</span><span className="flex items-center gap-1"><Scale className="w-3 h-3" /> FSMA</span></div>
              </Reveal>

              {/* floating trust */}
              <div className="hidden md:flex absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-card border p-4 items-center gap-3 motion-float">
                <div className="w-10 h-10 rounded-full bg-emerald-50 grid place-items-center text-emerald-600"><Award className="w-5 h-5" /></div>
                <div><div className="text-sm font-extrabold text-ink">{tr("trust.rating")}</div><div className="text-xs text-slate-500">{tr("trust.sub")}</div></div>
              </div>
            </div>
          </div>

          {/* stats band like Dewi */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 border-t border-white/10 pt-8">
            {[
              { v: "8 400+", l: tr("stats.clients"), a: 8400, fmt: "int", suffixe: "+" },
              { v: "12 700", l: tr("stats.dossiers"), a: 12700, fmt: "int", suffixe: "" },
              { v: "4,8/5", l: tr("stats.satisfaction"), a: 4.8, fmt: "dec", suffixe: "/5" },
              { v: "<24h", l: tr("stats.delay"), a: 24, fmt: "h", suffixe: "" },
            ].map((s, i) => (
              <Reveal as="div" key={s.l} retard={i * 90} className="text-center md:text-left">
                <div className="text-[28px] md:text-[32px] font-extrabold text-white tracking-tight">
                  {/* `final` = la chaine litterale deja rendue par le serveur: l'animation part de la,
                      y revient, et ne re-compose jamais le nombre avec l'ICU du navigateur. */}
                  <CountUp a={s.a} final={s.v} duree={1150} format={(n) => (s.fmt === "dec"
                    ? formatNumber(n, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    : s.fmt === "h"
                      ? "<" + Math.round(n)
                      : formatNumber(Math.round(n), locale)) + s.suffixe} />
                </div>
                <div className="text-[11px] tracking-widest uppercase font-bold text-white/50">{s.l}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Clients / regulators bar — grayscale */}
      <section className="bg-surface border-y">
        <div className="mx-auto max-w-[1280px] px-6 py-6 flex flex-wrap items-center justify-between gap-6 opacity-70">
          <span className="text-[11px] tracking-widest uppercase font-bold text-slate-500">{tr("partners.label")}</span>
          <Reveal as="div" variant="fade" retard={120} className="flex flex-wrap items-center gap-8 text-sm font-extrabold tracking-tight text-slate-400">
            <span className="flex items-center gap-2"><Building2 className="w-5 h-5" /> BNB</span>
            <span>FSMA</span>
            <span>Febelfin</span>
            <span>CTIF</span>
            <span>eIDAS</span>
            <span>itsme®</span>
          </Reveal>
        </div>
      </section>

      {/* ABOUT — Dewi style with image + checklist */}
      <section id="about" className="mx-auto max-w-[1280px] px-6 py-16 md:py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <Reveal as="div" className="section-title">{tr("about.eyebrow")}</Reveal>
            <Reveal as="h2" retard={80} className="section-heading mt-2">{tr("about.title")}</Reveal>
            <Reveal as="p" retard={150} className="mt-4 text-[15px] leading-7 text-slate-600">{tr("about.p1")}</Reveal>
            <Reveal as="p" retard={210} className="mt-4 text-[15px] leading-7 text-slate-600">{tr("about.p2")}</Reveal>
            <ul className="mt-6 space-y-3">
              {["aboutCheck.1", "aboutCheck.2", "aboutCheck.3"].map((li, i) => (
                <Reveal as="li" key={li} retard={280 + i * 80} variant="left" className="flex gap-3 text-sm"><span className="mt-0.5 w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0"><Check className="w-3.5 h-3.5" /></span><span className="text-slate-700">{tr(li)}</span></Reveal>
              ))}
            </ul>
            <Reveal as="div" retard={380} className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-white text-xs font-bold tracking-widest uppercase"><Award className="w-4 h-4 text-primary" /> {tr("about.badge")}</Reveal>
          </div>
          <div className="relative">
            <Image src="https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&auto=format&fit=crop&q=80" alt="team" width={900} height={560} sizes="(min-width: 1024px) 45vw, 100vw" className="rounded-[24px] w-full h-[420px] object-cover shadow-card" />
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-card border p-5 w-[280px] hidden md:block">
              <div className="text-xs tracking-widest uppercase font-bold text-slate-500">{tr("compliance.title")}</div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">KYC/AML</span><span className="font-bold text-emerald-600">{tr("compliance.active")}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">RGPD</span><span className="font-bold text-emerald-600">{tr("compliance.active")}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{tr("compliance.audit")}</span><span className="font-bold text-emerald-600">{tr("compliance.immutable")}</span></div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 bg-primary text-white rounded-2xl p-4 shadow-card hidden md:block motion-float">
              <div className="text-2xl font-extrabold">BE</div><div className="text-[11px] tracking-widest uppercase font-bold opacity-90">{tr("compliance.pilot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Services — 3 cards with image top like Dewi */}
      <section id="produits" className="bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="text-center max-w-2xl mx-auto">
            <div className="section-title justify-center flex">{tr("featured.title")}</div>
            <h2 className="section-heading mt-2">{tr("featured.subtitle")}</h2>
          </div>

          <div className="mt-10 grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[
              { icon: Wallet, code: "PERSONAL" as const, title: tr("products.personal"), descKey: "products.personal.desc", img: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=600&auto=format&fit=crop&q=80", tagKey: "products.personal.tag" },
              { icon: Home, code: "MORTGAGE" as const, title: tr("products.mortgage"), descKey: "products.mortgage.desc", img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&auto=format&fit=crop&q=80", tagKey: "products.mortgage.tag" },
              { icon: Briefcase, code: "BUSINESS" as const, title: tr("products.business"), descKey: "products.business.desc", img: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&auto=format&fit=crop&q=80", tagKey: "products.business.tag" },
              { icon: BarChart3, code: "INVESTMENT" as const, title: tr("products.invest"), descKey: "products.invest.desc", img: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80", tagKey: "products.invest.tag" },
            ].map((card, i) => (
              <Reveal as="div" key={card.title} retard={i * 85} pas={28} spotlight className="bg-white rounded-[20px] overflow-hidden shadow-soft border group lift">
                <div className="relative h-[180px] overflow-hidden"><Image src={card.img} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="h-full object-cover group-hover:scale-[1.03] transition duration-500" /><span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-[11px] font-bold tracking-widest uppercase text-ink border">{tr(card.tagKey)}</span></div>
                <div className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary-light text-primary grid place-items-center"><card.icon className="w-5 h-5" /></div>
                  <h3 className="mt-3 font-extrabold text-ink">{card.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{tr(card.descKey)}</p>
                  {/* Bornes et durées lues dans PRODUITS: la description du dictionnaire ne porte plus
                      que le qualitatif, donc aucun chiffre ne peut vieillir dans quatre fichiers. */}
                  <div className="mt-3 text-[11px] font-bold tracking-wide text-slate-400">
                    {formatMontantCompact(PRODUITS[card.code].min, locale)} – {formatMontantCompact(PRODUITS[card.code].max, locale)} • {PRODUITS[card.code].minTerm}–{PRODUITS[card.code].maxTerm} m
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{tr("products.from")} <span className="text-ink">{formatPercent(tauxMiniProduit(card.code), locale, 2)} TAEG*</span></span>
                    <a href="#simulateur" className="text-xs font-bold tracking-widest uppercase text-primary flex items-center gap-1">{tr("products.cta")} <ArrowRight className="w-3.5 h-3.5" /></a>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3">{tr("products.note")}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Process tabs — Dewi Features tabs reinterpreted */}
      <section className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="text-center">
          <div className="section-title justify-center flex">{tr("process.eyebrow")}</div>
          <h2 className="section-heading">{tr("process.title")}</h2>
          <p className="text-slate-500 mt-2">{tr("process.subtitle")}</p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            { t: "process.tab1", d: "process.tab1d" },
            { t: "process.tab2", d: "process.tab2d" },
            { t: "process.tab3", d: "process.tab3d" },
            { t: "process.tab4", d: "process.tab4d" },
          ].map((tab, i) => (
            <button key={tab.t} onClick={() => setActiveTab(i)} className={`px-5 py-3 rounded-full text-xs font-bold tracking-widest uppercase border transition active:scale-[.97] ${activeTab===i ? "bg-ink text-white border-ink" : "bg-white text-slate-600 border-slate-200 hover:border-ink/20"}`}>{tr(tab.t)}</button>
          ))}
        </div>

        <div key={activeTab} className="motion-pop mt-8 grid lg:grid-cols-2 gap-8 items-center bg-white rounded-[24px] border shadow-soft p-6 md:p-8">
          <div>
            <h3 className="text-xl font-extrabold text-ink">{
tr(["process.h1", "process.h2", "process.h3", "process.h4"][activeTab])
            }</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{
tr(["process.h1d", "process.h2d", "process.h3d", "process.h4d"][activeTab])
            }</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> {tr("process.check1")}</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> {tr("process.check2")}</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> {tr("process.check3")}</li>
            </ul>
          </div>
          <Image key={activeTab} src={["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=800&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&auto=format&fit=crop&q=80"][activeTab]} alt="" width={800} height={500} sizes="(min-width: 1024px) 50vw, 100vw" className="rounded-2xl w-full h-[300px] object-cover" />
        </div>
      </section>

      {/* Services 6 boxes — Dewi icon grid */}
      <section id="services" className="bg-ink text-white py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-primary text-[13px] tracking-[0.18em] font-bold uppercase">{tr("services.title")}</div>
            <h2 className="text-[32px] md:text-[36px] font-extrabold mt-2">{tr("services.subtitle")}</h2>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              { icon: Lock, titleKey: "services.secure.t", descKey: "services.secure.d" },
              { icon: Scale, titleKey: "services.compliant.t", descKey: "services.compliant.d" },
              { icon: Clock, titleKey: "services.fast.t", descKey: "services.fast.d" },
              { icon: Fingerprint, titleKey: "services.config.t", descKey: "services.config.d" },
              { icon: FileCheck, titleKey: "services.transparent.t", descKey: "services.transparent.d" },
              { icon: Bell, titleKey: "services.notify.t", descKey: "services.notify.d" },
            ].map((s, i) => (
              <Reveal as="div" key={s.titleKey} retard={i * 70} variant="scale" spotlight className="bg-white/[0.04] border border-white/10 rounded-[20px] p-6 lift">
                <div className="w-11 h-11 rounded-xl bg-primary grid place-items-center"><s.icon className="w-5 h-5 text-white" /></div>
                <h3 className="mt-4 font-bold text-white">{tr(s.titleKey)}</h3>
                <p className="mt-1 text-sm leading-6 text-white/60">{tr(s.descKey)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* SIMULATOR — anchor */}
      <section id="simulateur" className="bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6">
          <Reveal as="div" variant="fade" className="text-center max-w-2xl mx-auto mb-8">
            <div className="section-title justify-center flex"><span className="inline-flex items-center gap-2"><Calculator className="w-4 h-4" /> {tr("simulatorCta.eyebrow")}</span></div>
            <h2 className="section-heading">{tr("simulatorCta.title")}</h2>
            <p className="text-slate-500 mt-2">{tr("simulatorCta.subtitle")}</p>
          </Reveal>
          <Simulator locale={locale} />
          <div className="mt-6 bg-white rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-600 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> {tr("simulatorCta.help")}</div>
            <div className="flex gap-2"><a href="#contact" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-bold"><MessageCircle className="w-4 h-4"/> WhatsApp</a><a href="tel:+3228081234" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-white text-sm font-bold"><Phone className="w-4 h-4"/> +32 2 808 12 34</a></div>
          </div>
        </div>
      </section>

      {/* Testimonials — over image like Dewi */}
      <section className="relative py-16">
        <Image src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&auto=format&fit=crop&q=80" alt="" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-ink/80" />
        <div className="relative mx-auto max-w-[1280px] px-6">
          <Reveal as="div" variant="fade" className="text-center text-white">
            <div className="text-primary text-[13px] tracking-[0.18em] font-bold uppercase">{tr("testimonials.title")}</div>
            <h2 className="text-[32px] font-extrabold mt-2">{tr("testimonials.sub")}</h2>
          </Reveal>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {[
              { nKey: "testimonials.a1", rKey: "testimonials.q1", s: 5 },
              { nKey: "testimonials.a2", rKey: "testimonials.q2", s: 5 },
              { nKey: "testimonials.a3", rKey: "testimonials.q3", s: 5 },
            ].map((tes, i) => (
              <Reveal as="div" key={tes.nKey} retard={i * 110} variant="rise" className="bg-white rounded-2xl p-6 shadow-card lift">
                <div className="flex gap-1 text-amber-400">{Array.from({length:5}).map((_,i)=><Star key={i} className="w-4 h-4 fill-current"/> )}</div>
                <Quote className="w-6 h-6 text-primary/20 mt-3" />
                <p className="text-sm leading-6 text-slate-700 mt-1">“{tr(tes.rKey)}”</p>
                <div className="mt-4 flex items-center gap-3">
                  <Image src={`https://i.pravatar.cc/100?img=${tes.s+10}`} alt="" width={36} height={36} className="rounded-full" />
                  <div><div className="text-sm font-bold text-ink">{tr(tes.nKey)}</div><div className="text-xs text-slate-500">{tr("testimonials.verified")}</div></div>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="text-center text-[11px] text-white/50 mt-6">{tr("testimonials.note")}</p>
        </div>
      </section>

      {/* AUTH / ROLES demo */}
      <section id="auth" className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <div className="section-title justify-center flex">{tr("auth.title")}</div>
          <h2 className="section-heading text-[28px]">{tr("roles.title")}</h2>
          <p className="text-slate-500 mt-2">{tr("auth.subtitle")}</p>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {[
            { key:"CUSTOMER" as const, role: tr("roles.customer"), icon: Users, color: "bg-emerald-500", items: ["roles.customer.1","roles.customer.2","roles.customer.3","roles.customer.4"], ctaKey: "roles.customer.cta", href: `/${locale}/dashboard` },
            { key:"ADMIN" as const, role: tr("roles.admin"), icon: Shield, color: "bg-ink", items: ["roles.admin.1","roles.admin.2","roles.admin.3","roles.admin.4"], ctaKey: "roles.admin.cta", href: `/${locale}/admin/dashboard` },
            { key:"SUPER_ADMIN" as const, role: tr("roles.super"), icon: Award, color: "bg-primary", items: ["roles.super.1","roles.super.2","roles.super.3","roles.super.4"], ctaKey: "roles.super.cta", href: `/${locale}/admin/dashboard` },
          ].map(card => {
            const already = isAuthenticated && user?.role === card.key;
            return (
            <div key={card.role} className="bg-white rounded-[24px] border shadow-soft p-6">
              <div className={`w-12 h-12 rounded-xl ${card.color} text-white grid place-items-center`}><card.icon className="w-6 h-6"/></div>
              <div className="mt-3 text-xs tracking-widest uppercase font-bold text-slate-500">{card.role}</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {card.items.map(i=> <li key={i} className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5"/>{tr(i)}</li>)}
              </ul>
              {already ? (
                <Link href={card.href} className="mt-5 w-full h-11 rounded-full bg-emerald-600 text-white border border-emerald-600 font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2">{tr("roles.goDashboard")} <ArrowRight className="w-4 h-4"/></Link>
              ) : (
                                <button onClick={() => ouvrirPortail(card.key)} className="mt-5 w-full h-11 rounded-full bg-white border border-slate-200 font-bold text-sm hover:bg-surface flex items-center justify-center gap-2 sheen">{tr(card.ctaKey)} <ArrowRight className="w-4 h-4" /></button>
              )}
              <div className="text-[11px] text-slate-400 text-center mt-2">{COMPTES_DEMO.find((c) => c.role === card.key)?.email} — {tr("roles.demoNote")}</div>
            </div>
          )})}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border bg-white px-5 py-4 shadow-soft">
          <span className="text-[13px] font-semibold text-slate-600">{tNs(locale, "auth", "lien.basculer.inscription")}</span>
          <button
            onClick={() => { basculerPortail("inscription"); router.push(`/${locale}/auth`); }}
            className={buttonClasses("primary", "md", "gap-2")}
          >
            {tNs(locale, "auth", "onglet.inscription")} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <FileCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs leading-5 text-amber-900"><strong>{tr("auditNote.label")}</strong> {tr("auditNote.body")}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface py-12">
        <div className="mx-auto max-w-[900px] px-6">
          <h3 className="text-center font-extrabold text-ink text-xl">{tr("faq.title")}</h3>
          <div className="mt-6 space-y-3">
            {[
              { q: "faq.q1", a: "faq.a1" },
              { q: "faq.q2", a: "faq.a2" },
              { q: "faq.q3", a: "faq.a3" },
              { q: "faq.q4", a: "faq.a4" },
            ].map(f => (
              <details key={f.q} className="bg-white rounded-2xl border p-5 group open:shadow-soft lift">
                <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-ink text-sm">{tr(f.q)} <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition" /></summary>
                <p className="text-sm leading-6 text-slate-600 mt-3">{tr(f.a)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <div className="section-title">{tr("contact.title")}</div>
            <h2 className="section-heading text-[30px]">{tr("contact.subtitle")}</h2>
            <div className="mt-6 space-y-4">
              <div className="flex gap-3"><MapPin className="w-5 h-5 text-primary mt-0.5"/><div className="text-sm"><div className="font-bold text-ink">{tr("contact.hq")}</div><div className="text-slate-600">{tr("contact.address")}</div></div></div>
              <div className="flex gap-3"><Phone className="w-5 h-5 text-primary mt-0.5"/><div className="text-sm"><div className="font-bold text-ink">+32 2 808 12 34</div><div className="text-slate-600">{tr("contact.hours")}</div></div></div>
              <div className="flex gap-3"><Mail className="w-5 h-5 text-primary mt-0.5"/><div className="text-sm"><div className="font-bold text-ink">hello@kredit.be</div><div className="text-slate-600">{tr("contact.emailNote")}</div></div></div>
              <div className="flex gap-3"><MessageCircle className="w-5 h-5 text-emerald-500 mt-0.5"/><div className="text-sm"><div className="font-bold text-ink">WhatsApp Business</div><div className="text-slate-600">{tr("contact.whatsappNote")}</div></div></div>
            </div>
            <div className="mt-6 rounded-2xl overflow-hidden border h-[220px] bg-surface grid place-items-center text-slate-400 text-sm">
              {tr("contact.map")}
            </div>
          </div>

          <form onSubmit={e=>{e.preventDefault(); alert(tr("contact.sent"));}} className="bg-white rounded-[24px] border shadow-soft p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm font-semibold text-ink">{tr("contact.name")}<input required className="mt-1 w-full h-11 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder={tr("contact.namePh")}/></label>
              <label className="text-sm font-semibold text-ink">{tr("contact.email")}<input required type="email" className="mt-1 w-full h-11 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="vous@email.be"/></label>
            </div>
            <label className="text-sm font-semibold text-ink mt-4 block">{tr("contact.subject")}<input className="mt-1 w-full h-11 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder={tr("contact.subjectPh")}/></label>
            <label className="text-sm font-semibold text-ink mt-4 block">{tr("contact.message")}<textarea required rows={5} className="mt-1 w-full rounded-xl border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder={tr("contact.messagePh")}/><span className="text-[11px] text-slate-400">{tr("contact.noSensitive")}</span></label>
            <label className="flex gap-2 mt-4 text-xs text-slate-600"><input type="checkbox" required className="mt-0.5"/> {tr("contact.consent")}</label>
            <Button type="submit" className="w-full mt-4">{tr("contact.submit")}</Button>
            <p className="text-[11px] text-slate-400 text-center mt-3">{tr("contact.afterNote")}</p>
          </form>
        </div>
      </section>

      {/* bottom CTA banner like Dewi */}
      <section className="bg-primary py-8">
        <Reveal as="div" variant="rise" className="mx-auto max-w-[1280px] px-6 flex flex-wrap items-center justify-between gap-4">
          <div><div className="text-white font-extrabold text-lg">{tr("cta.banner")}</div><div className="text-white/90 text-sm">{tr("cta.bannerSub")}</div></div>
          <Link href="#simulateur" className="inline-flex items-center gap-2 h-11 px-7 rounded-full bg-white text-ink font-bold text-sm hover:bg-white/90">{tr("cta.simulate")} <ArrowRight className="w-4 h-4"/></Link>
        </Reveal>
      </section>
    </div>
  );
}
