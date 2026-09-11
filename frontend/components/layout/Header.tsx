"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Globe, Shield, ChevronDown, Check, LogOut, LayoutDashboard } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Locale, locales, t, setPersistedLocale } from "@/lib/i18n";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConnectivityDot } from "@/components/pwa/ConnectivityStatus";
import { useAuth, useAuthHydrated } from "@/hooks/useAuth";

const localeLabels: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",
};

export default function Header({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { hasHydrated, isAuthenticated, user } = useAuthHydrated();
  const logout = useAuth((s) => s.logout);
  const switchLocale = (l: Locale) => {
    setPersistedLocale(l);
    const parts = pathname.split("/");
    parts[1] = l;
    router.push(parts.join("/") || `/${l}`);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) fetch(`${apiUrl}/api/v1/customers/me/preferences`, { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ locale: l }) }).catch(()=>{});
  };
  const tr = (k: string) => t(locale, k);
  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push(`/${locale}`);
  };
  const dashboardHref = (() => {
    if (!user) return `/${locale}/dashboard`;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return `/${locale}/admin/dashboard`;
    return `/${locale}/dashboard`;
  })();

  useEffect(() => {
    if (!langOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-lang-dropdown]")) setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLangOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey as any);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey as any);
    };
  }, [langOpen]);
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-ink/95 backdrop-blur border-b border-white/5">
      <div className="mx-auto max-w-[1280px] px-6 h-[72px] flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold text-sm">K</div>
          <span className="text-white font-display font-extrabold tracking-tight text-[22px]">KREDIT<span className="text-primary">.</span></span>
          <span className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[10px] font-bold tracking-widest uppercase border border-white/10">
            <Shield className="w-3 h-3" /> BE • EUR
          </span>
          <span className="hidden lg:inline-flex ml-2"><ConnectivityDot /></span>
        </Link>

        <nav className="hidden lg:flex items-center gap-5 xl:gap-6">
          <Link href={`/${locale}#simulateur`} className="nav-link whitespace-nowrap">{tr("nav.simulator")}</Link>
          <Link href={`/${locale}#produits`} className="nav-link whitespace-nowrap">{tr("nav.products")}</Link>
          <Link href={`/${locale}#services`} className="nav-link whitespace-nowrap">{tr("nav.invest")}</Link>
          <Link href={`/${locale}#about`} className="nav-link whitespace-nowrap hidden xl:inline">{tr("nav.about")}</Link>
          <Link href={`/${locale}#contact`} className="nav-link whitespace-nowrap hidden xl:inline">{tr("nav.contact")}</Link>
        </nav>

        <div className="hidden lg:flex items-center gap-2 xl:gap-3">
          {/* Langues — liste déroulante compacte (économise ~80px vs pill 4 boutons) */}
          <div className="relative" data-lang-dropdown data-testid="lang-dropdown">
            <button
              data-testid="lang-dropdown-trigger"
              onClick={() => setLangOpen(!langOpen)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label="Changer de langue"
              className="flex items-center gap-1.5 pl-2.5 pr-2 h-8 rounded-full bg-white/10 border border-white/10 text-white text-[11px] font-bold uppercase hover:bg-white/15 transition backdrop-blur"
            >
              <Globe className="w-3.5 h-3.5 text-white/60 shrink-0" />
              <span className="w-5 text-center leading-none">{locale}</span>
              <ChevronDown className={cn("w-3 h-3 text-white/60 transition-transform shrink-0", langOpen && "rotate-180")} />
            </button>
            {langOpen && (
              <div
                role="listbox"
                data-testid="lang-dropdown-list"
                aria-label="Langues disponibles"
                className="absolute right-0 top-full mt-2 w-44 rounded-2xl bg-[#1E2028] border border-white/10 shadow-2xl overflow-hidden py-1.5 z-50"
              >
                {locales.map((l) => (
                  <button
                    key={l}
                    role="option"
                    aria-selected={locale === l}
                    onClick={() => { switchLocale(l); setLangOpen(false); }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-[13px] font-medium transition text-left",
                      locale === l ? "bg-white text-ink font-bold" : "text-white/85 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={cn("w-7 h-7 rounded-full grid place-items-center text-[10px] font-extrabold shrink-0", locale===l ? "bg-ink text-white" : "bg-white/10 text-white/90")}>{l.toUpperCase()}</span>
                      <span>{localeLabels[l as Locale]}</span>
                    </span>
                    {locale === l && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                ))}
                <div className="mx-3 mt-1.5 pt-1.5 border-t border-white/10 text-[10px] leading-3 text-white/40 text-center">BE • EUR • Europe/Brussels</div>
              </div>
            )}
          </div>
          {/* Auth area — hydratation-aware */}
          {!hasHydrated ? (
            <span className="w-24 h-8 rounded-full bg-white/5 animate-pulse hidden xl:inline-block" />
          ) : isAuthenticated && user ? (
            <>
              <Link href={dashboardHref} className="hidden xl:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/10 border border-white/10 text-white text-[12px] font-semibold hover:bg-white/15">
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </Link>
              <div className="flex items-center gap-2 pl-3 pr-1 h-8 rounded-full bg-white border border-slate-200">
                <span className="hidden xl:inline text-[12px] font-bold text-ink max-w-[140px] truncate" title={user.email}>{user.email}</span>
                <span className="hidden xl:inline px-1.5 py-0.5 rounded-full bg-ink text-white text-[10px] font-bold tracking-widest uppercase">{user.role === "SUPER_ADMIN" ? "SUPER" : user.role}</span>
                <button onClick={handleLogout} aria-label="Déconnexion" className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 grid place-items-center text-slate-600">
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            <>
              <Link href={`/${locale}#auth`} className="text-white/90 hover:text-white text-[13px] font-semibold whitespace-nowrap hidden xl:inline"> {tr("nav.login")} </Link>
              <Link href={`/${locale}#simulateur`} className={buttonClasses("primary", "md", "!h-9 !px-5 !text-[13px] whitespace-nowrap shrink-0")}>{tr("nav.cta")}</Link>
            </>
          )}
        </div>

        <button onClick={() => setOpen(!open)} className="lg:hidden w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10">
          {open ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-ink border-t border-white/10 px-6 py-6 space-y-5">
          {/* User pill mobile when authenticated */}
          {hasHydrated && isAuthenticated && user && (
            <div className="rounded-2xl bg-white p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ink text-white grid place-items-center font-bold">{user.email[0]?.toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-ink truncate">{user.email}</div>
                <div className="text-xs text-slate-500">{user.role} • {locale.toUpperCase()} • BE</div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          )}
          {/* Langues en liste verticale — économise largeur, plus lisible que pill horizontale */}
          <div>
            <p className="text-[11px] tracking-widest uppercase font-bold text-white/50 mb-2.5">Langue • Language • Taal • Sprache</p>
            <div className="rounded-2xl bg-white/[0.06] border border-white/10 overflow-hidden">
              {locales.map((l) => (
                <button
                  key={l}
                  onClick={() => { switchLocale(l); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 text-sm font-semibold border-b border-white/10 last:border-0 transition text-left",
                    locale === l ? "bg-white text-ink" : "text-white/85 hover:bg-white/10"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className={cn("w-8 h-8 rounded-full grid place-items-center text-xs font-extrabold", locale===l ? "bg-ink text-white" : "bg-white/15 text-white")}>{l.toUpperCase()}</span>
                    <span>{localeLabels[l as Locale]}</span>
                    <span className="text-white/40 font-normal hidden sm:inline text-xs">— {l === "fr" ? "FR-BE" : l === "nl" ? "NL-BE" : l === "de" ? "DE-BE" : "EN-BE"}</span>
                  </span>
                  {locale === l && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
          <nav className="space-y-1">
            <Link href={`/${locale}#simulateur`} onClick={()=>setOpen(false)} className="block nav-link py-2.5 text-base">{tr("nav.simulator")}</Link>
            <Link href={`/${locale}#produits`} onClick={()=>setOpen(false)} className="block nav-link py-2.5 text-base">{tr("nav.products")}</Link>
            <Link href={`/${locale}#services`} onClick={()=>setOpen(false)} className="block nav-link py-2.5 text-base">{tr("nav.invest")}</Link>
            <Link href={`/${locale}#about`} onClick={()=>setOpen(false)} className="block nav-link py-2.5 text-base">{tr("nav.about")}</Link>
            <Link href={`/${locale}#contact`} onClick={()=>setOpen(false)} className="block nav-link py-2.5 text-base">{tr("nav.contact")}</Link>
            {hasHydrated && isAuthenticated && (
              <Link href={dashboardHref} onClick={()=>setOpen(false)} className="block nav-link py-2.5 text-base font-bold text-primary">→ Dashboard</Link>
            )}
          </nav>
          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            {hasHydrated && isAuthenticated ? (
              <button onClick={handleLogout} className="h-11 rounded-full bg-white text-ink font-semibold flex items-center justify-center gap-2"><LogOut className="w-4 h-4"/> Déconnexion</button>
            ) : (
              <>
                <Link href={`/${locale}#auth`} onClick={()=>setOpen(false)} className="h-11 rounded-full bg-white/10 border border-white/15 text-white font-semibold grid place-items-center">{tr("nav.login")}</Link>
                <Link href={`/${locale}#simulateur`} onClick={()=>setOpen(false)} className={buttonClasses("primary", "md", "w-full !h-11")}>{tr("nav.cta")}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
