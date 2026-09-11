"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { useState } from "react";
import { Settings, Users, Package, Scale, Percent, Globe, Languages, Sliders, Plug, Bell, ScrollText, Lock } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const [role, setRole] = useState<'ADMIN'|'SUPER_ADMIN'>('SUPER_ADMIN');
  const [tab, setTab] = useState('admins');
  const isSuper = role==='SUPER_ADMIN';
  return (
    <AdminShell locale={locale} role={role}>
      <div className="space-y-4">
        <div className="flex flex-wrap justify-between gap-4">
          <div><h1 className="text-[22px] font-extrabold text-ink">Réglages</h1><p className="text-sm text-slate-500">ADMIN lecture • SUPER_ADMIN écriture (9 onglets) • MFA re-auth pour sensible</p></div>
          <div className="flex gap-2">
            <button onClick={()=>setRole('ADMIN')} className={`h-9 px-4 rounded-full text-xs font-bold border ${role==='ADMIN'?'bg-ink text-white':'bg-white'}`}>Voir en ADMIN</button>
            <button onClick={()=>setRole('SUPER_ADMIN')} className={`h-9 px-4 rounded-full text-xs font-bold border ${role==='SUPER_ADMIN'?'bg-primary text-white':'bg-white'}`}>Voir en SUPER_ADMIN</button>
          </div>
        </div>
        {!isSuper && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-sm"><Lock className="w-4 h-4 text-amber-600"/> Lecture seule — SUPER_ADMIN requis pour modifier. MFA obligatoire.</div>}
        <div className="bg-white rounded-2xl border p-2 flex flex-wrap gap-2">
          {[
            {k:'admins', label:'Administrateurs', icon:Users},
            {k:'products', label:'Produits', icon:Package},
            {k:'rules', label:'Règles', icon:Scale},
            {k:'rates', label:'Taux', icon:Percent},
            {k:'countries', label:'Pays', icon:Globe},
            {k:'languages', label:'Langues', icon:Languages},
            {k:'params', label:'Params', icon:Sliders},
            {k:'integrations', label:'Intégrations', icon:Plug},
            {k:'logs', label:'Logs', icon:ScrollText},
          ].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} className={`px-3 py-2 rounded-full text-xs font-bold border flex items-center gap-1 ${tab===t.k?'bg-ink text-white':'bg-white'}`}>
              <t.icon className="w-3 h-3"/>{t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border p-6">
          {tab==='admins' && (
            <div>
              <h3 className="font-bold">Administrateurs</h3>
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm"><thead className="text-xs tracking-widest uppercase text-slate-500 border-b"><tr><th className="text-left py-2">Email</th><th>Rôle</th><th>MFA</th><th></th></tr></thead>
                  <tbody className="divide-y">
                    <tr><td className="py-2">admin@kredit.be</td><td>ADMIN</td><td><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs">MFA ✓</span></td><td><button disabled={!isSuper} className={`h-8 px-3 rounded-full text-xs font-bold border ${!isSuper?'opacity-50':''}`}>Réinitialiser MFA</button></td></tr>
                    <tr><td className="py-2">super@kredit.be</td><td>SUPER_ADMIN</td><td><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs">MFA ✓</span></td><td><button disabled={!isSuper} className="h-8 px-3 rounded-full border text-xs font-bold">Gérer</button></td></tr>
                  </tbody>
                </table>
              </div>
              <button disabled={!isSuper} className={`mt-3 h-9 px-4 rounded-full text-sm font-bold ${isSuper?'bg-ink text-white':'bg-slate-100 text-slate-400'}`}>+ Nouvel admin</button>
            </div>
          )}
          {tab==='products' && (
            <div>
              <h3 className="font-bold">Produits (versionnés)</h3>
              <div className="mt-3 grid md:grid-cols-3 gap-3">
                {['Personnel 1 500-50 000 12-84m','Hypothécaire 50k-500k 60-300m','Business 5k-250k 12-120m'].map(p=>(
                  <div key={p} className="p-3 rounded-xl bg-surface border"><div className="font-bold text-sm">{p}</div><div className="text-xs text-slate-500">v3 effective 2026-01-01</div><button disabled={!isSuper} className="mt-2 h-8 px-3 rounded-full border text-xs font-bold">Éditer</button></div>
                ))}
              </div>
            </div>
          )}
          {tab==='rules' && (
            <div>
              <h3 className="font-bold">Règles</h3>
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm"><thead className="text-xs tracking-widest uppercase text-slate-500 border-b"><tr><th className="text-left py-2">Clé</th><th>Valeur</th><th>Hard</th><th>Legal</th></tr></thead>
                  <tbody className="divide-y">
                    <tr><td className="py-2 font-mono text-xs">max_debt_ratio</td><td>0.33</td><td><span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs">soft</span></td><td>⚠️ à valider</td></tr>
                    <tr><td className="py-2 font-mono text-xs">min_age</td><td>18</td><td><span className="px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs">hard</span></td><td>✓</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {tab==='rates' && (
            <div>
              <h3 className="font-bold">Taux par bande</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="p-3 rounded-xl bg-surface border flex justify-between"><span>BE PERSONAL 10001-25000 12-72m 3.99%</span><button disabled={!isSuper} className="h-7 px-3 rounded-full border text-xs font-bold">Éditer</button></div>
                <div className="p-3 rounded-xl bg-surface border flex justify-between"><span>BE MORTGAGE 50k-500k 3.25%</span><button disabled={!isSuper} className="h-7 px-3 rounded-full border text-xs font-bold">Éditer</button></div>
              </div>
            </div>
          )}
          {tab==='countries' && (
            <div>
              <h3 className="font-bold">Pays</h3>
              <div className="mt-3 space-y-2">
                <div className="p-3 rounded-xl bg-ink text-white flex justify-between"><span>BE • EUR • FR/NL/DE • Actif</span><span className="text-emerald-300">●</span></div>
                <div className="p-3 rounded-xl bg-surface border flex justify-between"><span>FR • EUR • FR • Bientôt</span><button disabled={!isSuper} className="h-7 px-3 rounded-full border text-xs">+ Ajouter</button></div>
              </div>
            </div>
          )}
          {tab==='languages' && <div><h3 className="font-bold">Langues</h3><div className="mt-3 flex gap-2">{['FR','EN','NL','DE'].map(l=><span key={l} className="px-3 py-2 rounded-full bg-ink text-white text-sm font-bold">{l} • Actif</span>)}</div></div>}
          {tab==='params' && <div><h3 className="font-bold">Paramètres globaux</h3><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between p-3 rounded-xl bg-surface border"><span>exceptionThreshold</span><span className="font-mono">50000</span></div><div className="flex justify-between p-3 rounded-xl bg-surface border"><span>retention KYC</span><span>10y</span></div></div></div>}
          {tab==='integrations' && <div><h3 className="font-bold">Intégrations</h3><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between p-3 rounded-xl bg-surface border"><span>itsme® KYC</span><span className="text-emerald-600">● ON</span></div><div className="flex justify-between p-3 rounded-xl bg-surface border"><span>Mollie SEPA</span><span className="text-emerald-600">● ON</span></div><div className="flex justify-between p-3 rounded-xl bg-surface border"><span>WhatsApp Cloud</span><span className="text-slate-400">○ OFF</span></div></div></div>}
          {tab==='logs' && <div><h3 className="font-bold">Logs</h3><div className="mt-3 font-mono text-xs bg-ink text-white/80 rounded-xl p-3">[2026-09-09] SUPER_ADMIN update rate hash a3f9…<br/>[2026-09-09] ADMIN decide KRD-0842</div></div>}
        </div>
        <div className="bg-white rounded-2xl border p-4 flex items-center gap-2 text-xs"><Settings className="w-4 h-4"/> Toute écriture SUPER_ADMIN → audit hash + history + event. Re-MFA demandé pour sensible.</div>
      </div>
    </AdminShell>
  );
}
