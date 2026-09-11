"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, Calculator, Wallet, TrendingUp, CreditCard, FolderKanban, Bell, Settings, User, Shield, LogOut, Menu, X, Home, Lock } from "lucide-react";
import { useState } from "react";
import { Locale } from "@/lib/i18n";
import { useAuth, useAuthHydrated } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";

const nav = [
  { href:'dashboard', label:'Dashboard', icon: LayoutDashboard },
  { href:'credit', label:'Crédit', icon: Wallet },
  { href:'credit/simulator', label:'Simulateur', icon: Calculator, indent:true },
  { href:'credit/applications', label:'Mes demandes', icon: FolderKanban, indent:true },
  { href:'credit/documents', label:'Documents', icon: FileText, indent:true },
  { href:'credit/repayments', label:'Échéanciers', icon: CreditCard, indent:true },
  { href:'investments', label:'Investissements', icon: TrendingUp },
  { href:'payments', label:'Paiements', icon: CreditCard },
  { href:'notifications', label:'Notifications', icon: Bell, badge:3 },
  { href:'profile', label:'Profil', icon: User },
  { href:'security', label:'Sécurité', icon: Shield },
  { href:'settings', label:'Réglages', icon: Settings },
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
            <h1 className="mt-4 text-xl font-extrabold text-ink">Espace client — connexion requise</h1>
            <p className="text-sm text-slate-500 mt-2">Vous n’êtes pas connecté. La persistance a été corrigée : votre session survit au refresh (localStorage <code className="bg-slate-100 px-1 rounded">kredit-auth</code>).</p>
            <p className="text-xs text-slate-400 mt-2">Mode démo local — aucun backend requis. Cliquez pour vous connecter en tant que CUSTOMER.</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={handleDemoLogin} className="w-full justify-center">Se connecter en démo (alex@kredit.be)</Button>
              <Link href={`/${locale}#auth`} className="text-sm font-semibold text-primary text-center">Retour à l’accueil — choisir un rôle</Link>
              <Link href={`${base}/dashboard`} onClick={handleDemoLogin} className="text-xs text-slate-500 underline text-center">Ou continuer en lecture seule (maquette)</Link>
            </div>
            <div className="mt-6 bg-slate-50 rounded-xl p-3 text-left">
              <div className="text-xs font-bold text-ink">Astuce debug</div>
              <div className="text-xs text-slate-600 mt-1">Après connexion, rafraîchissez la page (F5) : vous restez connecté. Le header affiche votre email et le point SYNCING/ONLINE.</div>
            </div>
          </div>
          {/* Still render children in read-only muted */}
          <div className="mt-8 opacity-60 pointer-events-none select-none">
            <div className="text-xs tracking-widest uppercase font-bold text-slate-400 text-center mb-2">Aperçu maquette (lecture seule)</div>
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
        <span className="font-bold text-sm tracking-widest uppercase text-slate-500">Espace client</span>
        <Link href={`${base}/dashboard`} className="w-10 h-10 rounded-full bg-primary text-white grid place-items-center"><Home className="w-4 h-4"/></Link>
      </div>
      <div className="mx-auto max-w-[1280px] px-0 lg:px-6 flex gap-6 py-0 lg:py-6">
        {/* sidebar desktop */}
        <aside className={`${open? 'block':'hidden'} lg:block w-full lg:w-[260px] shrink-0 lg:sticky lg:top-[88px] h-fit`}>
          <div className="bg-white rounded-none lg:rounded-[20px] border lg:sticky lg:top-[88px] overflow-hidden shadow-soft">
            <div className="p-4 border-b flex items-center gap-3">
              <Image src={avatarImg} alt="" width={40} height={40} className="rounded-full object-cover" />
              <div className="min-w-0"><div className="text-sm font-bold text-ink truncate">{displayName}</div><div className="text-xs text-slate-500 truncate">{displayEmail} • BE</div></div>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="KYC vérifié — connecté" />
            </div>
            <nav className="p-2">
              {nav.map((item: any)=>{
                const active = pathname.endsWith(`/${item.href}`) || pathname.includes(`/${item.href}/`);
                return (
                  <Link key={item.href} href={`${base}/${item.href}`} onClick={()=>setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${item.indent?'ml-4 text-[13px]':''} ${active? 'bg-ink text-white':'text-slate-600 hover:bg-surface hover:text-ink'}`}>
                    <item.icon className="w-4 h-4 shrink-0"/>{item.label}
                    {item.badge && <span className="ml-auto bg-primary text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                  </Link>
                )
              })}
            </nav>
            <div className="p-3 border-t">
              <div className="bg-primary-light rounded-xl p-3">
                <div className="text-xs font-bold text-ink">Besoin d&#39;aide ?</div>
                <div className="text-xs text-slate-600">Un ADMIN humain répond &lt;24h</div>
                <Link href={`${base}/#contact`} className="mt-2 inline-flex h-8 px-3 rounded-full bg-ink text-white text-xs font-bold items-center">Contacter</Link>
              </div>
              <button onClick={handleLogout} className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-surface"><LogOut className="w-4 h-4"/> Déconnexion</button>
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
          {href:'dashboard', icon: LayoutDashboard, label:'Accueil'},
          {href:'credit/applications', icon: FolderKanban, label:'Dossiers'},
          {href:'credit/documents', icon: FileText, label:'Docs'},
          {href:'profile', icon: User, label:'Profil'},
        ].map(i=>(
          <Link key={i.href} href={`${base}/${i.href}`} className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500">
            <i.icon className="w-5 h-5"/><span className="text-[11px] font-bold">{i.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
