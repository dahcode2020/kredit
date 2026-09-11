"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale, locales } from "@/lib/i18n";
import { useState } from "react";
import { Check, AlertTriangle, Loader } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ firstName:"Alex", lastName:"Martin", birthDate:"1990-04-12", nationality:"BE", address:"Rue de la Loi 100, 1000 Bruxelles", niss:"*** 123", phone:"+32 470 12 34 56", email:"alex@kredit.be", locale:"fr" });
  const save = (e:any)=>{ e.preventDefault(); setSaving(true); setTimeout(()=>{setSaving(false); setSuccess(true); setTimeout(()=>setSuccess(false),2000)},800); };
  return (
    <CustomerShell locale={locale}>
      <div className="max-w-[720px] space-y-6">
        <div><h1 className="text-[22px] font-extrabold text-ink">Profil</h1><p className="text-sm text-slate-500">Modifiez vos infos — vérif email/tél requise avant soumission</p></div>
        {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex gap-2 text-sm"><Check className="w-4 h-4"/> Profil mis à jour — audit OK</div>}
        <form onSubmit={save} className="bg-white rounded-2xl border p-6 space-y-4 shadow-soft">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold">Prénom*<input value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})} className="mt-1 w-full h-11 rounded-xl border px-3" required minLength={2}/></label>
            <label className="text-sm font-semibold">Nom*<input value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})} className="mt-1 w-full h-11 rounded-xl border px-3" required/></label>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold">Naissance*<input type="date" value={form.birthDate} onChange={e=>setForm({...form, birthDate:e.target.value})} className="mt-1 w-full h-11 rounded-xl border px-3" required/>
              <span className="text-[11px] text-slate-400">≥18 ans (hard guard)</span>
            </label>
            <label className="text-sm font-semibold">Nationalité*<select value={form.nationality} onChange={e=>setForm({...form, nationality:e.target.value})} className="mt-1 w-full h-11 rounded-xl border px-3 bg-white"><option value="BE">Belgique</option><option value="FR">France</option><option value="NL">Pays-Bas</option><option value="DE">Allemagne</option></select></label>
          </div>
          <label className="text-sm font-semibold">Adresse (BeSt)*<input value={form.address} onChange={e=>setForm({...form, address:e.target.value})} className="mt-1 w-full h-11 rounded-xl border px-3" placeholder="Rue, CP, Ville" required/></label>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold">NISS (hashé)<input value={form.niss} readOnly className="mt-1 w-full h-11 rounded-xl border px-3 bg-surface text-slate-500"/></label>
            <label className="text-sm font-semibold">Téléphone*<input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} className="mt-1 w-full h-11 rounded-xl border px-3" placeholder="+32 ..." required pattern="\\+32.*"/></label>
          </div>
          <label className="text-sm font-semibold">Email<input value={form.email} readOnly className="mt-1 w-full h-11 rounded-xl border px-3 bg-surface"/><span className="text-xs text-emerald-600">✓ Vérifié</span></label>
          <label className="text-sm font-semibold">Langue préférée
            <div className="mt-1 flex gap-2">
              {locales.map(l=>(
                <button key={l} type="button" onClick={()=>setForm({...form, locale:l})} className={`flex-1 h-10 rounded-xl border text-sm font-bold uppercase ${form.locale===l?'bg-ink text-white':'bg-white'}`}>{l}</button>
              ))}
            </div>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 h-11 rounded-full bg-ink text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{saving? <Loader className="w-4 h-4 animate-spin"/>: <Check className="w-4 h-4"/>} Enregistrer</button>
            <button type="button" onClick={()=>history.back()} className="h-11 px-6 rounded-full border font-bold">Annuler</button>
          </div>
          <p className="text-[11px] text-slate-400">Champs * obligatoires. Erreur inline + aria-invalid. Loading skeleton si fetch, empty jamais (profil existe).</p>
        </form>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs"><AlertTriangle className="w-4 h-4 text-amber-600"/> Màj NISS soumise à KYC redo.</div>
      </div>
    </CustomerShell>
  );
}
