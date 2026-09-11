"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { useState } from "react";
import { Shield, Smartphone, Monitor, LogOut, Key, Check } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const [tab, setTab] = useState("pwd");
  return (
    <CustomerShell locale={locale}>
      <div className="max-w-[720px] space-y-6">
        <h1 className="text-[22px] font-extrabold text-ink">Sécurité</h1>
        <div className="flex gap-2">
          {[
            {k:"pwd", label:"Mot de passe", icon:Key},
            {k:"2fa", label:"2FA", icon:Smartphone},
            {k:"sessions", label:"Sessions", icon:Monitor},
          ].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} className={`px-4 py-2 rounded-full text-sm font-bold border flex items-center gap-2 ${tab===t.k?'bg-ink text-white':'bg-white'}`}>{<t.icon className="w-4 h-4"/>}{t.label}</button>
          ))}
        </div>
        {tab==="pwd" && (
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <h3 className="font-bold">Changer mot de passe</h3>
            <label className="text-sm font-semibold block">Ancien*<input type="password" className="mt-1 w-full h-11 rounded-xl border px-3" required/></label>
            <label className="text-sm font-semibold block">Nouveau* (12+ chars)<input type="password" className="mt-1 w-full h-11 rounded-xl border px-3" required minLength={12}/></label>
            <label className="text-sm font-semibold block">Confirmer*<input type="password" className="mt-1 w-full h-11 rounded-xl border px-3" required/></label>
            <button className="w-full h-11 rounded-full bg-ink text-white font-bold">Mettre à jour — re-auth requis</button>
            <p className="text-xs text-slate-400">Validation Zod, error inline, success toast + audit.</p>
          </div>
        )}
        {tab==="2fa" && (
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2"><Shield className="w-4 h-4 text-primary"/> 2FA TOTP</h3>
            <div className="bg-surface rounded-xl p-4 text-center">
              <div className="w-32 h-32 bg-white border rounded-xl mx-auto grid place-items-center text-xs">QR Code</div>
              <p className="text-xs text-slate-500 mt-2">Scannez avec Authenticator</p>
            </div>
            <label className="text-sm font-semibold block">Code 6 chiffres<input className="mt-1 w-full h-11 rounded-xl border px-3 text-center tracking-widest" placeholder="123456" pattern="\\d{6}"/></label>
            <button className="w-full h-11 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center gap-2"><Check className="w-4 h-4"/> Activer 2FA</button>
          </div>
        )}
        {tab==="sessions" && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="p-4 border-b font-bold">Sessions actives</div>
            {[
              {device:"Chrome • Bruxelles", ip:"185.12.34.56", last:"Aujourd'hui 14:22", current:true},
              {device:"Safari • iPhone", ip:"81.22.11.9", last:"Hier", current:false},
            ].map(s=>(
              <div key={s.ip} className="p-4 flex justify-between items-center hover:bg-surface/50">
                <div><div className="text-sm font-bold flex items-center gap-2">{s.device} {s.current && <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Actuelle</span>}</div><div className="text-xs text-slate-500">{s.ip} • {s.last}</div></div>
                <button className="h-8 px-3 rounded-full border text-xs font-bold flex items-center gap-1"><LogOut className="w-3 h-3"/> Révoquer</button>
              </div>
            ))}
            <div className="p-4"><button className="w-full h-10 rounded-full border font-bold text-sm">Déconnexion partout</button></div>
          </div>
        )}
      </div>
    </CustomerShell>
  );
}
