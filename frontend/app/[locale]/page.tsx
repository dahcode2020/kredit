"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, buttonClasses } from "@/components/ui/Button";
import Simulator from "@/components/credit/Simulator";
import { Locale, t } from "@/lib/i18n";
import { useAuth, useAuthHydrated } from "@/hooks/useAuth";
import { Check, Shield, Lock, FileCheck, Clock, Users, TrendingUp, Star, Play, ArrowRight, Award, Building2, Wallet, Home, Briefcase, BarChart3, Fingerprint, Scale, Bell, MessageCircle, Mail, Phone, MapPin, Quote, ChevronDown, Calculator, Info } from "lucide-react";

export default function Page({ params }: { params: { locale: string } }) {
  const locale = params.locale as Locale;
  const tr = (k: string) => t(locale, k);
  const [activeTab, setActiveTab] = useState(0);
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const { isAuthenticated, user } = useAuthHydrated();
  const handleDemoLogin = (role: "CUSTOMER"|"ADMIN"|"SUPER_ADMIN") => {
    const map: Record<string, { email: string; firstName: string; href: string }> = {
      CUSTOMER: { email: "alex@kredit.be", firstName: "Alex", href: `/${locale}/dashboard` },
      ADMIN: { email: "admin@kredit.be", firstName: "Admin", href: `/${locale}/admin/dashboard` },
      SUPER_ADMIN: { email: "super@kredit.be", firstName: "Super", href: `/${locale}/admin/dashboard` },
    };
    const cfg = map[role];
    const u = { id: `demo-${role.toLowerCase()}`, email: cfg.email, role, locale, firstName: cfg.firstName, lastName: "Kredit" };
    const at = "demo-at-" + Math.random().toString(36).slice(2) + "-" + Date.now();
    const rt = "demo-rt-" + Math.random().toString(36).slice(2);
    login(u as any, at, rt);
    router.push(cfg.href);
  };

  return (
    <div className="bg-white">
      {/* HERO — Dewi style: dark overlay with stats left, image bg */}
      <section className="relative overflow-hidden bg-ink">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&auto=format&fit=crop&q=80" alt="" className="w-full h-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[1280px] px-6 py-16 md:py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] tracking-widest uppercase font-bold text-white/90 backdrop-blur">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {tr("hero.eyebrow")}
              </div>
              <h1 className="mt-6 font-display font-extrabold text-white leading-[0.95] tracking-tight text-[42px] md:text-[56px]">
                {tr("hero.title1")} <br />
                <span className="text-white">{tr("hero.title2")}</span> <br />
                <span className="text-primary">{tr("hero.title3")}</span>
              </h1>
              <p className="mt-5 text-[15px] leading-7 text-white/70 max-w-[560px]">{tr("hero.subtitle")}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="#simulateur" className={buttonClasses("primary", "lg", "gap-2")}>{tr("hero.cta1")} <ArrowRight className="w-4 h-4" /></Link>
                <a href="#about" className="inline-flex items-center gap-3 h-[48px] px-6 rounded-full bg-white text-ink font-bold text-sm hover:bg-white/90 transition"><span className="w-8 h-8 rounded-full bg-ink text-white grid place-items-center"><Play className="w-3.5 h-3.5 ml-0.5" /></span>{tr("hero.cta2")}</a>
              </div>

              <div className="mt-6 flex items-center gap-3 text-[11px] font-semibold tracking-widest uppercase text-white/50">
                <Shield className="w-4 h-4 text-emerald-400" /> {tr("hero.trust")}
              </div>
              <p className="mt-4 text-[11px] leading-5 text-white/45 border-l-2 border-primary/50 pl-3 max-w-[560px]">{tr("hero.disclaimer")}</p>
            </div>

            {/* Right: Simulator hero card preview */}
            <div className="relative">
              <div className="bg-white rounded-[24px] shadow-card p-6 md:p-7">
                <div className="flex items-center justify-between">
                  <Badge>Belgique • BE</Badge>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Système opérationnel</span>
                </div>
                <h3 className="mt-4 font-extrabold text-ink text-lg">Simulez en 60 secondes</h3>
                <p className="text-sm text-slate-500">Montant, durée, TAEG — calcul transparent, méthode française.</p>

                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-surface border p-3"><div className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Dès</div><div className="font-extrabold text-ink">3,25%</div><div className="text-[11px] text-slate-400">TAEG</div></div>
                  <div className="rounded-2xl bg-surface border p-3"><div className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Jusqu’à</div><div className="font-extrabold text-ink">500k€</div><div className="text-[11px] text-slate-400">hypo.</div></div>
                  <div className="rounded-2xl bg-surface border p-3"><div className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Réponse</div><div className="font-extrabold text-ink">&lt;24h</div><div className="text-[11px] text-slate-400">après KYC</div></div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Exemple: 15 000€ / 48 mois</span><span className="font-bold text-ink">338,84€ / mois</span></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-[68%] bg-primary rounded-full" /></div>
                  <p className="text-[11px] text-slate-400">Simulation indicative uniquement — ne constitue pas une offre ferme. Décision humaine obligatoire.</p>
                </div>

                <Link href="#simulateur" className="mt-5 flex items-center justify-center gap-2 h-11 rounded-full bg-ink text-white font-bold text-sm hover:bg-ink-light transition">Lancer le simulateur <ArrowRight className="w-4 h-4" /></Link>
                <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-slate-400"><span className="flex items-center gap-1"><Lock className="w-3 h-3" /> RGPD</span><span className="flex items-center gap-1"><FileCheck className="w-3 h-3" /> eIDAS</span><span className="flex items-center gap-1"><Scale className="w-3 h-3" /> FSMA</span></div>
              </div>

              {/* floating trust */}
              <div className="hidden md:flex absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-card border p-4 items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 grid place-items-center text-emerald-600"><Award className="w-5 h-5" /></div>
                <div><div className="text-sm font-extrabold text-ink">4,8/5 — 1 200 avis vérifiés</div><div className="text-xs text-slate-500">Avis collectés • Belgique</div></div>
              </div>
            </div>
          </div>

          {/* stats band like Dewi */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 border-t border-white/10 pt-8">
            {[
              { v: "8 400+", l: tr("stats.clients") },
              { v: "12 700", l: tr("stats.dossiers") },
              { v: "4,8/5", l: tr("stats.satisfaction") },
              { v: "<24h", l: tr("stats.delay") },
            ].map(s => (
              <div key={s.l} className="text-center md:text-left">
                <div className="text-[28px] md:text-[32px] font-extrabold text-white tracking-tight">{s.v}</div>
                <div className="text-[11px] tracking-widest uppercase font-bold text-white/50">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Clients / regulators bar — grayscale */}
      <section className="bg-surface border-y">
        <div className="mx-auto max-w-[1280px] px-6 py-6 flex flex-wrap items-center justify-between gap-6 opacity-70">
          <span className="text-[11px] tracking-widest uppercase font-bold text-slate-500">Régulateurs & partenaires</span>
          <div className="flex flex-wrap items-center gap-8 text-sm font-extrabold tracking-tight text-slate-400">
            <span className="flex items-center gap-2"><Building2 className="w-5 h-5" /> BNB</span>
            <span>FSMA</span>
            <span>Febelfin</span>
            <span>CTIF</span>
            <span>eIDAS</span>
            <span>itsme®</span>
          </div>
        </div>
      </section>

      {/* ABOUT — Dewi style with image + checklist */}
      <section id="about" className="mx-auto max-w-[1280px] px-6 py-16 md:py-20">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <div className="section-title">{tr("about.eyebrow")}</div>
            <h2 className="section-heading mt-2">{tr("about.title")}</h2>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">{tr("about.p1")}</p>
            <p className="mt-4 text-[15px] leading-7 text-slate-600">{tr("about.p2")}</p>
            <ul className="mt-6 space-y-3">
              {["Règles, taux, plafonds 100% configurables (pas en dur)", "Audit immuable hash-chaîné — preuve & traçabilité", "Décision finale humaine obligatoire (ADMIN / SUPER_ADMIN)"].map(li => (
                <li key={li} className="flex gap-3 text-sm"><span className="mt-0.5 w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0"><Check className="w-3.5 h-3.5" /></span><span className="text-slate-700">{li}</span></li>
              ))}
            </ul>
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-white text-xs font-bold tracking-widest uppercase"><Award className="w-4 h-4 text-primary" /> {tr("about.badge")}</div>
          </div>
          <div className="relative">
            <img src="https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&auto=format&fit=crop&q=80" alt="team" className="rounded-[24px] w-full object-cover h-[420px] shadow-card" />
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-card border p-5 w-[280px] hidden md:block">
              <div className="text-xs tracking-widest uppercase font-bold text-slate-500">Conforme dès le design</div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">KYC/AML</span><span className="font-bold text-emerald-600">✓ Actif</span></div>
                <div className="flex justify-between"><span className="text-slate-500">RGPD</span><span className="font-bold text-emerald-600">✓ Actif</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Audit</span><span className="font-bold text-emerald-600">✓ Immuable</span></div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 bg-primary text-white rounded-2xl p-4 shadow-card hidden md:block">
              <div className="text-2xl font-extrabold">BE</div><div className="text-[11px] tracking-widest uppercase font-bold opacity-90">Pays pilote</div>
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
              { icon: Wallet, title: tr("products.personal"), desc: "1 500 — 50 000€ • 12-84 mois • TAEG dès 3,99% (indicatif)", img: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=600&auto=format&fit=crop&q=80", tag: "Consommation" },
              { icon: Home, title: tr("products.mortgage"), desc: "50k — 500k€ • 60-300 mois • TAEG dès 3,25% • Garantie hypothécaire", img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&auto=format&fit=crop&q=80", tag: "Hypothécaire" },
              { icon: Briefcase, title: tr("products.business"), desc: "5k — 250k€ • 12-120 mois • TAEG dès 4,50% • Indépendants & PME", img: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&auto=format&fit=crop&q=80", tag: "Professionnel" },
              { icon: BarChart3, title: tr("products.invest"), desc: "Fonds & obligations • Risque 1-7 • Quiz adéquation • Perte en capital possible", img: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80", tag: "Investissement" },
            ].map(card => (
              <div key={card.title} className="bg-white rounded-[20px] overflow-hidden shadow-soft border group hover:shadow-card transition">
                <div className="relative h-[180px] overflow-hidden"><img src={card.img} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500" /><span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur text-[11px] font-bold tracking-widest uppercase text-ink border">{card.tag}</span></div>
                <div className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-primary-light text-primary grid place-items-center"><card.icon className="w-5 h-5" /></div>
                  <h3 className="mt-3 font-extrabold text-ink">{card.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{card.desc}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{tr("products.from")} <span className="text-ink">3,25% TAEG*</span></span>
                    <a href="#simulateur" className="text-xs font-bold tracking-widest uppercase text-primary flex items-center gap-1">{tr("products.cta")} <ArrowRight className="w-3.5 h-3.5" /></a>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-3">* Indicatif, hors assurances. Validation juridique requise.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process tabs — Dewi Features tabs reinterpreted */}
      <section className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="text-center">
          <div className="section-title justify-center flex">Workflow</div>
          <h2 className="section-heading">{tr("process.title")}</h2>
          <p className="text-slate-500 mt-2">{tr("process.subtitle")}</p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            { t: "1. Demande", d: "Création DRAFT → SUBMITTED (idempotency-key)" },
            { t: "2. Vérifications", d: "KYC + AML + scoring (recommandation, pas décision)" },
            { t: "3. Décision humaine", d: "ADMIN décide, dérogation tracée avec motif" },
            { t: "4. Déblocage", d: "Contrat eIDAS → PSP SEPA → échéancier" },
          ].map((tab, i) => (
            <button key={tab.t} onClick={() => setActiveTab(i)} className={`px-5 py-3 rounded-full text-xs font-bold tracking-widest uppercase border transition ${activeTab===i ? "bg-ink text-white border-ink" : "bg-white text-slate-600 border-slate-200 hover:border-ink/20"}`}>{tab.t}</button>
          ))}
        </div>

        <div className="mt-8 grid lg:grid-cols-2 gap-8 items-center bg-white rounded-[24px] border shadow-soft p-6 md:p-8">
          <div>
            <h3 className="text-xl font-extrabold text-ink">{
              ["Votre demande en 5 minutes", "Le moteur contrôle, l'humain valide", "La décision finale est humaine", "Fonds débloqués en toute traçabilité"][activeTab]
            }</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{
              ["Formulaire guidé, documents via S3 présigné + scan antivirus. Idempotence garantie.", "Vérif identité (itsme® / Onfido), screening PEP/sanctions, ratio d'endettement. Scoring configurable.", "Aucune décision auto présentée comme bancaire définitive. Dérogation exceptionnelle possible mais auditée.", "Signature AES/QES, mandat SEPA, génération échéancier français, notifications multi-canal (Email/SMS/WhatsApp/Push)."][activeTab]
            }</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Conforme Livre VII CDE (BE)</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> RGPD • Données chiffrées • Rétention configurable</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5" /> Audit hash-chaîné, export WORM</li>
            </ul>
          </div>
          <img src={["https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=800&auto=format&fit=crop&q=80", "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&auto=format&fit=crop&q=80"][activeTab]} alt="" className="rounded-2xl w-full h-[300px] object-cover" />
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
              { icon: Lock, title: "Sécurisé & chiffré", desc: "TLS 1.3, AES-256 au repos, secrets vaultés, logs sans PII." },
              { icon: Scale, title: "Conforme & auditable", desc: "KYC/AML, SECCI, audit immuable, validation juridique traçée." },
              { icon: Clock, title: "Rapide mais humain", desc: "Scoring en <2s, mais décision finale humaine obligatoire." },
              { icon: Fingerprint, title: "Configurable par pays", desc: "Taux, plafonds, documents, règles — versionnés, jamais en dur." },
              { icon: FileCheck, title: "Transparent", desc: "Simulation ≠ offre. Échéancier détaillé, coûts totaux affichés." },
              { icon: Bell, title: "Notifié partout", desc: "Email, SMS, WhatsApp, Push — templates i18n FR/EN/NL/DE." },
            ].map(s => (
              <div key={s.title} className="bg-white/[0.04] border border-white/10 rounded-[20px] p-6 hover:bg-white/[0.06] transition">
                <div className="w-11 h-11 rounded-xl bg-primary grid place-items-center"><s.icon className="w-5 h-5 text-white" /></div>
                <h3 className="mt-4 font-bold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-6 text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SIMULATOR — anchor */}
      <section id="simulateur" className="bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="section-title justify-center flex"><span className="inline-flex items-center gap-2"><Calculator className="w-4 h-4" /> Simulateur</span></div>
            <h2 className="section-heading">Estimez, puis confiez à un expert</h2>
            <p className="text-slate-500 mt-2">Le calcul est instantané. La décision, elle, reste humaine.</p>
          </div>
          <Simulator locale={locale} />
          <div className="mt-6 bg-white rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-600 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Besoin d’un conseil? Parlez à un ADMIN (pas un bot) via WhatsApp ou téléphone.</div>
            <div className="flex gap-2"><a href="#contact" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-bold"><MessageCircle className="w-4 h-4"/> WhatsApp</a><a href="tel:+3228081234" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ink text-white text-sm font-bold"><Phone className="w-4 h-4"/> +32 2 808 12 34</a></div>
          </div>
        </div>
      </section>

      {/* Testimonials — over image like Dewi */}
      <section className="relative py-16">
        <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&auto=format&fit=crop&q=80" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-ink/80" />
        <div className="relative mx-auto max-w-[1280px] px-6">
          <div className="text-center text-white">
            <div className="text-primary text-[13px] tracking-[0.18em] font-bold uppercase">{tr("testimonials.title")}</div>
            <h2 className="text-[32px] font-extrabold mt-2">Des dossiers traités par des humains</h2>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {[
              { n: "Sophie D., Bruxelles", r: "Très claire, simulation honnête. L'admin a pris le temps d'expliquer le TAEG hors assurance. Dossier bouclé en 48h.", s: 5 },
              { n: "Tom V., Anvers", r: "J'ai apprécié que la plateforme dise explicitement 'ce n'est pas une offre'. On sait où on va. KYC via itsme® fluide.", s: 5 },
              { n: "Karim B., Liège", r: "Dérogation demandée (plafond dépassé de 8%). Motif enregistré, décision SUPER_ADMIN tracée. Pro et transparent.", s: 5 },
            ].map(tes => (
              <div key={tes.n} className="bg-white rounded-2xl p-6 shadow-card">
                <div className="flex gap-1 text-amber-400">{Array.from({length:5}).map((_,i)=><Star key={i} className="w-4 h-4 fill-current"/> )}</div>
                <Quote className="w-6 h-6 text-primary/20 mt-3" />
                <p className="text-sm leading-6 text-slate-700 mt-1">“{tes.r}”</p>
                <div className="mt-4 flex items-center gap-3">
                  <img src={`https://i.pravatar.cc/100?img=${tes.s+10}`} alt="" className="w-9 h-9 rounded-full" />
                  <div><div className="text-sm font-bold text-ink">{tes.n}</div><div className="text-xs text-slate-500">Client vérifié • BE</div></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-white/50 mt-6">Avis illustratifs — collecte réelle soumise à vérification et consentement RGPD.</p>
        </div>
      </section>

      {/* AUTH / ROLES demo */}
      <section id="auth" className="mx-auto max-w-[1280px] px-6 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <div className="section-title justify-center flex">{tr("auth.title")}</div>
          <h2 className="section-heading text-[28px]">3 rôles uniquement</h2>
          <p className="text-slate-500 mt-2">{tr("auth.subtitle")}</p>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-6">
          {[
            { key:"CUSTOMER" as const, role: tr("roles.customer"), icon: Users, color: "bg-emerald-500", items: ["Créer & suivre ses demandes", "KYC & documents", "Échéancier & paiements SEPA", "Notifications préférences"], cta: "Espace Customer", href: `/${locale}/dashboard` },
            { key:"ADMIN" as const, role: tr("roles.admin"), icon: Shield, color: "bg-ink", items: ["Gestion clients & dossiers", "Analyse scoring & documents", "Décision finale (humaine)", "Stats & notifications"], cta: "Espace Admin", href: `/${locale}/admin/dashboard` },
            { key:"SUPER_ADMIN" as const, role: tr("roles.super"), icon: Award, color: "bg-primary", items: ["Tout ADMIN +", "Config pays/produits/taux/règles", "Intégrations & feature flags", "Logs & audits sensibles"], cta: "Espace Super Admin", href: `/${locale}/admin/dashboard` },
          ].map(card => {
            const already = isAuthenticated && user?.role === card.key;
            return (
            <div key={card.role} className="bg-white rounded-[24px] border shadow-soft p-6">
              <div className={`w-12 h-12 rounded-xl ${card.color} text-white grid place-items-center`}><card.icon className="w-6 h-6"/></div>
              <div className="mt-3 text-xs tracking-widest uppercase font-bold text-slate-500">{card.role}</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {card.items.map(i=> <li key={i} className="flex gap-2"><Check className="w-4 h-4 text-emerald-500 mt-0.5"/>{i}</li>)}
              </ul>
              {already ? (
                <Link href={card.href} className="mt-5 w-full h-11 rounded-full bg-emerald-600 text-white border border-emerald-600 font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2">Aller au dashboard <ArrowRight className="w-4 h-4"/></Link>
              ) : (
                <button onClick={() => handleDemoLogin(card.key)} className="mt-5 w-full h-11 rounded-full bg-white border border-slate-200 font-bold text-sm hover:bg-surface flex items-center justify-center gap-2">{card.cta} <ArrowRight className="w-4 h-4"/></button>
              )}
              <div className="text-[11px] text-slate-400 text-center mt-2">{card.key === "CUSTOMER" ? "alex@kredit.be" : card.key === "ADMIN" ? "admin@kredit.be" : "super@kredit.be"} • démo sans backend • persistant</div>
            </div>
          )})}
        </div>

        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <FileCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs leading-5 text-amber-900"><strong>Audit & sécurité:</strong> chaque connexion, chaque décision, chaque changement de taux est journalisé (actor, before/after, hash chaîné). Les accès SUPER_ADMIN déclenchent une alerte.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface py-12">
        <div className="mx-auto max-w-[900px] px-6">
          <h3 className="text-center font-extrabold text-ink text-xl">Questions fréquentes — conformité</h3>
          <div className="mt-6 space-y-3">
            {[
              { q: "La simulation est-elle une offre ferme ?", a: "Non. C'est une estimation indicative avec TAEG à partir de, hors assurances/frais. L'offre ferme (SECCI) n'est émise qu'après KYC, scoring et validation humaine, sous réserve d'agrément." },
              { q: "Qui décide vraiment ?", a: "Le moteur recommande (APPROVE/REJECT/CONDITIONAL), l'ADMIN décide. Une dérogation exceptionnelle exige motif écrit + audit; au-delà du seuil, validation SUPER_ADMIN." },
              { q: "Quelles langues ?", a: "FR, EN, NL, DE — interfaces, emails, PDFs, notifications. La locale par défaut est FR (BE), extensible par pays." },
              { q: "Où sont mes données ?", a: "UE uniquement, chiffrées. Conservées selon règle pays (configurable, ex: 10 ans pour KYC BE). Droit d'accès, rectification, anonymisation prévu." },
            ].map(f => (
              <details key={f.q} className="bg-white rounded-2xl border p-5 group open:shadow-soft">
                <summary className="flex items-center justify-between cursor-pointer list-none font-bold text-ink text-sm">{f.q} <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition" /></summary>
                <p className="text-sm leading-6 text-slate-600 mt-3">{f.a}</p>
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
              <div className="flex gap-3"><MapPin className="w-5 h-5 text-primary mt-0.5"/><div className="text-sm"><div className="font-bold text-ink">Siège — Bruxelles</div><div className="text-slate-600">Avenue Louise 500, 1050 Bruxelles, Belgique</div></div></div>
              <div className="flex gap-3"><Phone className="w-5 h-5 text-primary mt-0.5"/><div className="text-sm"><div className="font-bold text-ink">+32 2 808 12 34</div><div className="text-slate-600">Lun–Ven 9h–18h (FR/NL/EN/DE)</div></div></div>
              <div className="flex gap-3"><Mail className="w-5 h-5 text-primary mt-0.5"/><div className="text-sm"><div className="font-bold text-ink">hello@kredit.be</div><div className="text-slate-600">Réponse sous 24h ouvrées</div></div></div>
              <div className="flex gap-3"><MessageCircle className="w-5 h-5 text-emerald-500 mt-0.5"/><div className="text-sm"><div className="font-bold text-ink">WhatsApp Business</div><div className="text-slate-600">Notifications & support (opt-in)</div></div></div>
            </div>
            <div className="mt-6 rounded-2xl overflow-hidden border h-[220px] bg-surface grid place-items-center text-slate-400 text-sm">
              Carte — Bruxelles (placeholder RGPD-friendly, pas de tracker par défaut)
            </div>
          </div>

          <form onSubmit={e=>{e.preventDefault(); alert("Message envoyé (démo). En prod: queue + Email/SMS + audit.");}} className="bg-white rounded-[24px] border shadow-soft p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm font-semibold text-ink">Nom<input required className="mt-1 w-full h-11 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Votre nom"/></label>
              <label className="text-sm font-semibold text-ink">Email<input required type="email" className="mt-1 w-full h-11 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="vous@email.be"/></label>
            </div>
            <label className="text-sm font-semibold text-ink mt-4 block">Sujet<input className="mt-1 w-full h-11 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Simulation, KYC, ..."/></label>
            <label className="text-sm font-semibold text-ink mt-4 block">Message<textarea required rows={5} className="mt-1 w-full rounded-xl border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="Décrivez votre projet..."/><span className="text-[11px] text-slate-400">Aucune donnée sensible (numéro national) via ce formulaire.</span></label>
            <label className="flex gap-2 mt-4 text-xs text-slate-600"><input type="checkbox" required className="mt-0.5"/> J&#39;accepte la politique de confidentialité et le traitement RGPD (UE).</label>
            <Button type="submit" className="w-full mt-4">Envoyer le message</Button>
            <p className="text-[11px] text-slate-400 text-center mt-3">Réponse humaine — pas de décision auto par ce formulaire.</p>
          </form>
        </div>
      </section>

      {/* bottom CTA banner like Dewi */}
      <section className="bg-primary py-8">
        <div className="mx-auto max-w-[1280px] px-6 flex flex-wrap items-center justify-between gap-4">
          <div><div className="text-white font-extrabold text-lg">{tr("cta.banner")}</div><div className="text-white/90 text-sm">{tr("cta.bannerSub")}</div></div>
          <Link href="#simulateur" className="inline-flex items-center gap-2 h-11 px-7 rounded-full bg-white text-ink font-bold text-sm hover:bg-white/90">Simuler maintenant <ArrowRight className="w-4 h-4"/></Link>
        </div>
      </section>
    </div>
  );
}
