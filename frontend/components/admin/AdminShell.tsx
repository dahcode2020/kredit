"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Users, FolderKanban, Wallet, TrendingUp, CreditCard, FileText, Bell, ShieldCheck, Settings, LogOut, Menu, X, AlertTriangle, Lock } from "lucide-react";
import { useState } from "react";
import { Locale, t } from "@/lib/i18n";
import { useAuth, useAuthHydrated } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

// Libellés = clés de dictionnaire (voir CustomerShell pour le pourquoi): le back-office est le même
// écran pour un admin francophone et néerlandophone, son menu ne peut pas être en dur.
// `badge:'12'` reste en dur: c'est une maquette de données, pas de la copie.
const nav = [
  { href:'admin/dashboard', labelKey:'nav.dashboard', icon: LayoutDashboard },
  { href:'admin/customers', labelKey:'nav.clients', icon: Users },
  { href:'admin/kyc', labelKey:'nav.kyc', icon: ShieldCheck },
  { href:'admin/credit-applications', labelKey:'nav.applications', icon: FolderKanban, badge:'12' },
  { href:'admin/loans', labelKey:'nav.loans', icon: Wallet },
  { href:'admin/investments', labelKey:'nav.investments', icon: TrendingUp },
  { href:'admin/payments', labelKey:'nav.payments', icon: CreditCard },
  { href:'admin/documents', labelKey:'nav.documents', icon: FileText },
  { href:'admin/notifications', labelKey:'nav.notifications', icon: Bell },
  { href:'admin/audit', labelKey:'nav.audit', icon: ShieldCheck },
  { href:'admin/settings', labelKey:'nav.settings', icon: Settings, super:true },
];

function demoLogin(locale: Locale, role: "ADMIN"|"SUPER_ADMIN", login: any) {
  const email = role === "SUPER_ADMIN" ? "super@kredit.be" : "admin@kredit.be";
  const user = { id: role === "SUPER_ADMIN" ? "super-demo" : "admin-demo", email, role, locale, firstName: role === "SUPER_ADMIN" ? "Super" : "Admin", lastName: "Kredit" };
  const at = "demo-at-" + Math.random().toString(36).slice(2);
  const rt = "demo-rt-" + Math.random().toString(36).slice(2);
  login(user, at, rt);
}

export default function AdminShell({ locale, role, children }: { locale: Locale; role: 'ADMIN'|'SUPER_ADMIN'; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const base = `/${locale}`;
  const { hasHydrated, isAuthenticated, user } = useAuthHydrated();
  const tr = (key: string, vars?: Record<string, any>) => t(locale, `common:${key}`, vars);
  const login = useAuth((s) => s.login);
  const logout = useAuth((s) => s.logout);
  const handleLogout = () => { logout(); setOpen(false); router.push(`/${locale}`); };
  const actualRole = user?.role as "ADMIN"|"SUPER_ADMIN"|"CUSTOMER"|undefined;
  const isSuperActual = actualRole === "SUPER_ADMIN";
  const hasAccess = (() => {
    if (!actualRole) return false;
    if (role === "ADMIN") return actualRole === "ADMIN" || actualRole === "SUPER_ADMIN";
    if (role === "SUPER_ADMIN") return actualRole === "SUPER_ADMIN";
    return false;
  })();
  const displayRole = actualRole ?? role;
  const isSuperBanner = isSuperActual || role === "SUPER_ADMIN";

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-[640px] px-6 py-16">
          <div className="bg-ink text-white rounded-[24px] p-8">
            <div className="w-12 h-12 rounded-xl bg-primary grid place-items-center"><Lock className="w-6 h-6" /></div>
            <h1 className="mt-4 text-xl font-extrabold">{tr("shell.adminGateTitle")}</h1>
            <p className="text-sm text-white/70 mt-2">{tr("shell.adminGateBody", { role })}</p>
            <p className="text-xs text-white/50 mt-1">{tr("shell.adminGateDemo")}</p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button onClick={() => demoLogin(locale, "ADMIN", login)} className="!bg-white !text-ink hover:!bg-white/90">{tr("shell.adminLogin", { role: "ADMIN" })}</Button>
              <Button onClick={() => demoLogin(locale, "SUPER_ADMIN", login)} className="!bg-primary !text-white">{tr("shell.adminLogin", { role: "SUPER_ADMIN" })}</Button>
            </div>
            <Link href={`/${locale}#auth`} className="block text-center text-sm text-white/70 underline mt-4">{tr("shell.adminGateBack")}</Link>
          </div>
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div className="text-sm text-amber-900">{tr("shell.note", { path: "/api/v1/auth/login" })}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="mx-auto max-w-[640px] px-6 py-12">
          <div className="bg-white rounded-2xl border shadow-soft p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 grid place-items-center mx-auto"><AlertTriangle className="w-6 h-6" /></div>
            <h1 className="mt-4 text-xl font-extrabold text-ink">{tr("shell.accessTitle")}</h1>
            <p className="text-sm text-slate-500 mt-2">{tr("shell.accessBody", { connected: actualRole ?? "—", required: role })}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => demoLogin(locale, role, login)}>{tr("shell.loginAsDemo", { role })}</Button>
              <button onClick={handleLogout} className="h-11 rounded-full border font-semibold text-sm">{tr("shell.logout")}</button>
              <Link href={`/${locale}/admin/dashboard`} className="text-sm text-primary underline">{tr("shell.goDashboard", { role: "ADMIN" })}</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayEmail = user?.email ?? (isSuperActual ? "super@kredit.be" : "admin@kredit.be");
  return (
    <div className="min-h-screen bg-surface">
      {/* MFA banner */}
      <div className="bg-emerald-600 text-white text-xs font-bold tracking-widest uppercase px-4 py-1.5 flex items-center gap-2 justify-center">
        <Lock className="w-3 h-3"/> {tr("shell.mfaEnabled")} • {displayRole} • {isSuperBanner ? tr("shell.modeSensitive") : tr("shell.modeOperational")}
        {isSuperActual && <span className="ml-2 bg-white text-emerald-700 px-2 py-0.5 rounded-full">SUPER_ADMIN</span>}
      </div>
      {/* mobile header */}
      <div className="lg:hidden sticky top-0 z-30 bg-ink text-white flex items-center justify-between px-4 h-14 border-b border-white/10">
        <button onClick={()=>setOpen(!open)} className="w-10 h-10 rounded-full bg-white/10 grid place-items-center">{open? <X className="w-5 h-5"/>: <Menu className="w-5 h-5"/>}</button>
        <span className="font-bold text-sm tracking-widest uppercase">{tr("shell.adminTitle")}</span>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${isSuperActual?'bg-primary':'bg-white/10'}`}>{displayRole}</span>
      </div>
      <div className="mx-auto max-w-[1280px] px-0 lg:px-6 flex gap-6 py-0 lg:py-6">
        <aside className={`${open? 'block':'hidden'} lg:block w-full lg:w-[280px] shrink-0 lg:sticky lg:top-6 h-fit`}>
          <div className="bg-ink text-white rounded-none lg:rounded-[20px] overflow-hidden shadow-soft border border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary grid place-items-center font-extrabold">K</div>
              <div className="min-w-0"><div className="font-extrabold truncate">KREDIT Admin{/* check-copy:ignore */}</div><div className="text-xs text-white/60 truncate">{displayEmail} • {displayRole}</div></div>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"/>
            </div>
            <nav className="p-2">
              {nav.map((item: any)=>{
                const active = pathname.includes(`/${item.href}`);
                const superOnly = item.super && !isSuperActual && displayRole !== "SUPER_ADMIN";
                return (
                  <Link key={item.href} href={`${base}/${item.href}`} onClick={()=>setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active? 'bg-white text-ink':'text-white/70 hover:bg-white/10 hover:text-white'} ${superOnly?'opacity-50 pointer-events-none':''}`}>
                    <item.icon className="w-4 h-4"/>{tr(item.labelKey)}
                    {item.badge && <span className="ml-auto bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                    {item.super && <span className="ml-auto text-[10px] tracking-widest uppercase bg-white/10 px-1.5 py-0.5 rounded-full">SUPER</span>}
                  </Link>
                )
              })}
            </nav>
            <div className="p-3 border-t border-white/10">
              <div className="bg-white/5 rounded-xl p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5"/><div className="text-xs"><div className="font-bold">{tr("shell.alerts", { count: 3 })}</div><div className="text-white/60">{tr("shell.alertsBody")}</div></div>
              </div>
              <button onClick={handleLogout} className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/60 hover:bg-white/10"><LogOut className="w-4 h-4"/> {tr("shell.logout")}</button>
            </div>
          </div>
        </aside>
        <main className="flex-1 min-w-0 px-4 lg:px-0 pb-8">
          {children}
        </main>
      </div>
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-ink text-white flex justify-around py-2 border-t border-white/10">
        {[
          {href:'admin/dashboard', icon: LayoutDashboard},
          {href:'admin/credit-applications', icon: FolderKanban},
          {href:'admin/customers', icon: Users},
          {href:'admin/audit', icon: ShieldCheck},
          {href:'admin/settings', icon: Settings},
        ].map(i=>(
          <Link key={i.href} href={`${base}/${i.href}`} className="flex flex-col items-center gap-1 py-1"><i.icon className="w-5 h-5"/><span className="text-[11px]">.</span></Link>
        ))}
      </div>
    </div>
  );
}
