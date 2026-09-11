"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, Calculator, Wallet, TrendingUp, CreditCard, FolderKanban, Bell, Settings, User, Shield, LogOut, Menu, X, Home, Lock } from "lucide-react";
import { useState } from "react";
import { Locale, t } from "@/lib/i18n";
import { useAuth, useAuthHydrated } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

/**
 * Navigation de l'espace client. La coquille est vue par les QUATRE langues: ses libellés sont donc
 * des clés (`nav.*`), jamais du texte — sinon le menu latéral reste français sur /nl et /de alors que
 * la page, elle, est traduite. `labelKey` plutôt qu'un `t()` ici: la table est module-level, sans
 * locale disponible (et l'évaluer au render serait recalculé à chaque fois — pointless).
 */
const nav = [
  { href:'dashboard', labelKey:'nav.dashboard', icon: LayoutDashboard },
  { href:'credit', labelKey:'nav.credit', icon: Wallet },
  { href:'credit/simulator', labelKey:'nav.simulator', icon: Calculator, indent:true },
  { href:'credit/applications', labelKey:'nav.applications', icon: FolderKanban, indent:true },
  { href:'credit/documents', labelKey:'nav.documents', icon: FileText, indent:true },
  { href:'credit/repayments', labelKey:'nav.repayments', icon: CreditCard, indent:true },
  { href:'investments', labelKey:'nav.investments', icon: TrendingUp },
  { href:'payments', labelKey:'nav.payments', icon: CreditCard },
  { href:'notifications', labelKey:'nav.notifications', icon: Bell, badge:3 },
  { href:'profile', labelKey:'nav.profile', icon: User },
  { href:'security', labelKey:'nav.security', icon: Shield },
  { href:'settings', labelKey:'nav.settings', icon: Settings },
];

function demoLoginAsCustomer(locale: Locale, login: any) {
  const user = { id: "cust-demo-1", email: "alex@kredit.be", role: "CUSTOMER" as const, locale, firstName: "Alex", lastName: "Martin" };
  const at = "demo-at-" + Math.random().toString(36).slice(2);
  const rt = "demo-rt-" + Math.random().toString(36).slice(2);
  login(user, at, rt);
}

export default function CustomerShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const base = `/${locale}`;
  const { hasHydrated, isAuthenticated, user } = useAuthHydrated();
  // Copie de la coquille: `t(locale, …)` est déterministe (la locale vient du segment [locale]),
  // donc serveur et navigateur rendent la même chaîne — pas d'hydratation à casser ici.
  const tr = (key: string, vars?: Record<string, any>) => t(locale, `common:${key}`, vars);
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push(`/${locale}`);
  };
  const handleDemoLogin = () => {
    demoLoginAsCustomer(locale, login);
  };

  // Loading skeleton while hydrating persist (évite flash "non connecté" au refresh)
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-surface grid place-items-center py-20">
        <div className="bg-white rounded-2xl border p-8 shadow-soft max-w-md w-full mx-4 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse mx-auto" />
          <div className="h-4 bg-slate-100 animate-pulse rounded mt-4 w-32 mx-auto" />
          <div className="h-3 bg-slate-100 animate-pulse rounded mt-2 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  // Non connecté — invite démo (persist corrigée, ne perd plus au refresh)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-[640px] px-6 py-16">
          <div className="bg-white rounded-[24px] border shadow-soft p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 grid place-items-center mx-auto"><Lock className="w-7 h-7" /></div>
            <h1 className="mt-4 text-xl font-extrabold text-ink">{tr("shell.gateTitle")}</h1>
            <p className="text-sm text-slate-500 mt-2">{tr("shell.gateBody", { key: "kredit-auth" })}</p>
            <p className="text-xs text-slate-400 mt-2">{tr("shell.gateDemo")}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={handleDemoLogin} className="w-full justify-center">{tr("shell.gateLogin", { email: "alex@kredit.be" })}</Button>
              <Link href={`/${locale}#auth`} className="text-sm font-semibold text-primary text-center">{tr("shell.gateBack")}</Link>
              <Link href={`${base}/dashboard`} onClick={handleDemoLogin} className="text-xs text-slate-500 underline text-center">{tr("shell.gateReadOnly")}</Link>
            </div>
            <div className="mt-6 bg-slate-50 rounded-xl p-3 text-left">
              <div className="text-xs font-bold text-ink">{tr("shell.debugTitle")}</div>
              <div className="text-xs text-slate-600 mt-1">{tr("shell.debugBody")}</div>
            </div>
          </div>
          {/* Still render children in read-only muted */}
          <div className="mt-8 opacity-60 pointer-events-none select-none">
            <div className="text-xs tracking-widest uppercase font-bold text-slate-400 text-center mb-2">{tr("shell.gatePreview")}</div>
            {children}
          </div>
        </div>
      </div>
    );
  }

  const displayName = user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email?.split("@")[0] ?? "Alex Martin";
  const displayEmail = user?.email ?? "alex@kredit.be";
  const avatarImg = user?.email?.includes("alex") ? "https://i.pravatar.cc/100?img=12" : `https://i.pravatar.cc/100?u=${encodeURIComponent(displayEmail)}`;

  return (
    <div className="min-h-screen bg-surface">
      {/* mobile header */}
      <div className="lg:hidden sticky top-[72px] z-30 bg-white border-b flex items-center justify-between px-4 h-14">
        <button onClick={()=>setOpen(!open)} className="w-10 h-10 rounded-full bg-ink text-white grid place-items-center">{open? <X className="w-5 h-5"/>: <Menu className="w-5 h-5"/>}</button>
        <span className="font-bold text-sm tracking-widest uppercase text-slate-500">{tr("shell.customerTitle")}</span>
        <Link href={`${base}/dashboard`} className="w-10 h-10 rounded-full bg-primary text-white grid place-items-center"><Home className="w-4 h-4"/></Link>
      </div>
      <div className="mx-auto max-w-[1280px] px-0 lg:px-6 flex gap-6 py-0 lg:py-6">
        {/* sidebar desktop */}
        <aside className={`${open? 'block':'hidden'} lg:block w-full lg:w-[260px] shrink-0 lg:sticky lg:top-[88px] h-fit`}>
          <div className="bg-white rounded-none lg:rounded-[20px] border lg:sticky lg:top-[88px] overflow-hidden shadow-soft">
            <div className="p-4 border-b flex items-center gap-3">
              <Image src={avatarImg} alt="" width={40} height={40} className="rounded-full object-cover" />
              <div className="min-w-0"><div className="text-sm font-bold text-ink truncate">{displayName}</div><div className="text-xs text-slate-500 truncate">{displayEmail} • BE</div></div>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title={tr("shell.kycVerified")} />
            </div>
            <nav className="p-2">
              {nav.map((item: any)=>{
                const active = pathname.endsWith(`/${item.href}`) || pathname.includes(`/${item.href}/`);
                return (
                  <Link key={item.href} href={`${base}/${item.href}`} onClick={()=>setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${item.indent?'ml-4 text-[13px]':''} ${active? 'bg-ink text-white':'text-slate-600 hover:bg-surface hover:text-ink'}`}>
                    <item.icon className="w-4 h-4 shrink-0"/>{tr(item.labelKey)}
                    {item.badge && <span className="ml-auto bg-primary text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                  </Link>
                )
              })}
            </nav>
            <div className="p-3 border-t">
              <div className="bg-primary-light rounded-xl p-3">
                <div className="text-xs font-bold text-ink">{tr("shell.helpTitle")}</div>
                <div className="text-xs text-slate-600">{tr("shell.helpBody")}</div>
                <Link href={`${base}/#contact`} className="mt-2 inline-flex h-8 px-3 rounded-full bg-ink text-white text-xs font-bold items-center">{tr("shell.helpCta")}</Link>
              </div>
              <button onClick={handleLogout} className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-surface"><LogOut className="w-4 h-4"/> {tr("shell.logout")}</button>
            </div>
          </div>
        </aside>

        {/* main */}
        <main className="flex-1 min-w-0 px-4 lg:px-0 pb-8">
          {children}
        </main>
      </div>

      {/* bottom nav mobile */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t flex justify-around py-2">
        {[
          {href:'dashboard', icon: LayoutDashboard, labelKey:'nav.home'},
          {href:'credit/applications', icon: FolderKanban, labelKey:'nav.applications'},
          {href:'credit/documents', icon: FileText, labelKey:'nav.documents'},
          {href:'profile', icon: User, labelKey:'nav.profile'},
        ].map(i=>(
          <Link key={i.href} href={`${base}/${i.href}`} className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500">
            <i.icon className="w-5 h-5"/><span className="text-[11px] font-bold">{tr(i.labelKey)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
