"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Calculator, Wallet, TrendingUp, CreditCard, FolderKanban, Bell, Settings, User, Shield, LogOut, Menu, X, Home } from "lucide-react";
import { useState } from "react";
import { Locale } from "@/lib/i18n";

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

export default function CustomerShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const base = `/${locale}`;
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
              <img src="https://i.pravatar.cc/100?img=12" alt="" className="w-10 h-10 rounded-full"/>
              <div><div className="text-sm font-bold text-ink">Alex Martin</div><div className="text-xs text-slate-500">alex@kredit.be • BE</div></div>
              <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="KYC vérifié"/>
            </div>
            <nav className="p-2">
              {nav.map(item=>{
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
                <div className="text-xs font-bold text-ink">Besoin d'aide ?</div>
                <div className="text-xs text-slate-600">Un ADMIN humain répond &lt;24h</div>
                <Link href={`${base}/#contact`} className="mt-2 inline-flex h-8 px-3 rounded-full bg-ink text-white text-xs font-bold items-center">Contacter</Link>
              </div>
              <button className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-surface"><LogOut className="w-4 h-4"/> Déconnexion</button>
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
