"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FolderKanban, Wallet, TrendingUp, CreditCard, FileText, Bell, ShieldCheck, Settings, LogOut, Menu, X, AlertTriangle, Lock } from "lucide-react";
import { useState } from "react";
import { Locale } from "@/lib/i18n";

const nav = [
  { href:'admin/dashboard', label:'Dashboard', icon: LayoutDashboard },
  { href:'admin/customers', label:'Clients', icon: Users },
  { href:'admin/kyc', label:'KYC', icon: ShieldCheck },
  { href:'admin/credit-applications', label:'Demandes', icon: FolderKanban, badge:'12' },
  { href:'admin/loans', label:'Prêts', icon: Wallet },
  { href:'admin/investments', label:'Investissements', icon: TrendingUp },
  { href:'admin/payments', label:'Paiements', icon: CreditCard },
  { href:'admin/documents', label:'Documents', icon: FileText },
  { href:'admin/notifications', label:'Notifications', icon: Bell },
  { href:'admin/audit', label:'Audit', icon: ShieldCheck },
  { href:'admin/settings', label:'Réglages', icon: Settings, super:true },
];

export default function AdminShell({ locale, role, children }: { locale: Locale; role: 'ADMIN'|'SUPER_ADMIN'; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/${locale}`;
  const isSuper = role==='SUPER_ADMIN';
  return (
    <div className="min-h-screen bg-surface">
      {/* MFA banner */}
      <div className="bg-emerald-600 text-white text-xs font-bold tracking-widest uppercase px-4 py-1.5 flex items-center gap-2 justify-center">
        <Lock className="w-3 h-3"/> MFA TOTP activé • {role} • {isSuper? 'Mode sensible': 'Opérationnel'}
        {isSuper && <span className="ml-2 bg-white text-emerald-700 px-2 py-0.5 rounded-full">SUPER_ADMIN</span>}
      </div>
      {/* mobile header */}
      <div className="lg:hidden sticky top-0 z-30 bg-ink text-white flex items-center justify-between px-4 h-14 border-b border-white/10">
        <button onClick={()=>setOpen(!open)} className="w-10 h-10 rounded-full bg-white/10 grid place-items-center">{open? <X className="w-5 h-5"/>: <Menu className="w-5 h-5"/>}</button>
        <span className="font-bold text-sm tracking-widest uppercase">Back-office</span>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${isSuper?'bg-primary':'bg-white/10'}`}>{role}</span>
      </div>
      <div className="mx-auto max-w-[1280px] px-0 lg:px-6 flex gap-6 py-0 lg:py-6">
        <aside className={`${open? 'block':'hidden'} lg:block w-full lg:w-[280px] shrink-0 lg:sticky lg:top-6 h-fit`}>
          <div className="bg-ink text-white rounded-none lg:rounded-[20px] overflow-hidden shadow-soft border border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary grid place-items-center font-extrabold">K</div>
              <div><div className="font-extrabold">KREDIT Admin</div><div className="text-xs text-white/60">admin@kredit.be • {role}</div></div>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
            </div>
            <nav className="p-2">
              {nav.map(item=>{
                const active = pathname.includes(`/${item.href}`);
                const superOnly = item.super && !isSuper;
                return (
                  <Link key={item.href} href={`${base}/${item.href}`} onClick={()=>setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active? 'bg-white text-ink':'text-white/70 hover:bg-white/10 hover:text-white'} ${superOnly?'opacity-50':''}`}>
                    <item.icon className="w-4 h-4"/>{item.label}
                    {item.badge && <span className="ml-auto bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{item.badge}</span>}
                    {item.super && <span className="ml-auto text-[10px] tracking-widest uppercase bg-white/10 px-1.5 py-0.5 rounded-full">SUPER</span>}
                  </Link>
                )
              })}
            </nav>
            <div className="p-3 border-t border-white/10">
              <div className="bg-white/5 rounded-xl p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5"/><div className="text-xs"><div className="font-bold">3 alertes</div><div className="text-white/60">KYC expiré, PSP échoué, docs manquants</div></div>
              </div>
              <button className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/60 hover:bg-white/10"><LogOut className="w-4 h-4"/> Déconnexion</button>
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
