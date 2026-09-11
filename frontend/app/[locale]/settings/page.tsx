"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale, locales } from "@/lib/i18n";
import { useState } from "react";
import { Globe, Bell, FileText, Trash2 } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const [lang, setLang] = useState(locale);
  return (
    <CustomerShell locale={locale}>
      <div className="max-w-[720px] space-y-6">
        <h1 className="text-[22px] font-extrabold text-ink">Réglages</h1>
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Globe className="w-4 h-4"/> Langue & devise</h3>
          <div className="flex gap-2">
            {locales.map(l=>(
              <button key={l} onClick={()=>setLang(l)} className={`flex-1 h-11 rounded-xl border font-bold uppercase ${lang===l?'bg-ink text-white':'bg-white'}`}>{l}</button>
            ))}
          </div>
          <p className="text-xs text-slate-500">FR/EN/NL/DE — interfaces, emails, PDFs, notifs. Devise <strong>EUR</strong> (readOnly).</p>
          <div className="h-10 rounded-xl bg-surface border flex items-center px-3 text-sm font-bold">EUR • BE</div>
        </div>
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-bold flex items-center gap-2"><Bell className="w-4 h-4"/> Notifications</h3>
          <p className="text-sm text-slate-500">Gérez dans <a href={`/${locale}/notifications`} className="text-primary font-bold">Centre notifs</a></p>
        </div>
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4"/> Données & consentement</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between p-3 rounded-xl bg-surface border"><span>Consentement RGPD v3</span><span className="text-emerald-600 font-bold"> Accepté 08/09/2026</span></div>
            <button className="w-full h-10 rounded-full border font-bold text-sm">Exporter mes données (JSON)</button>
            <button className="w-full h-10 rounded-full bg-red-50 text-red-700 border border-red-200 font-bold text-sm flex items-center justify-center gap-2"><Trash2 className="w-4 h-4"/> Demander suppression (anonymisation)</button>
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
