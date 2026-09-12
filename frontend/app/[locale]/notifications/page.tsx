"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { mockNotifs } from "@/lib/mock";
import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import RelativeTime from "@/components/ui/RelativeTime";
import { useState } from "react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  const [prefs, setPrefs] = useState({email:true, sms:true, whatsapp:false, push:true});
  const [list, setList] = useState(mockNotifs);
  return (
    <CustomerShell locale={locale}>
      <div className="max-w-[720px] space-y-6">
        <div className="flex justify-between"><div><h1 className="text-[22px] font-extrabold text-ink">Notifications</h1><p className="text-sm text-slate-500">4 canaux • templates i18n FR/EN/NL/DE</p></div><span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border text-xs font-bold">{list.filter(n=>!n.read).length} non lues</span></div>
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-bold mb-3">Préférences</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {k:"email", label:"Email", icon:Mail},
              {k:"sms", label:"SMS", icon:MessageCircle},
              {k:"whatsapp", label:"WhatsApp", icon:Smartphone},
              {k:"push", label:"Push", icon:Bell},
            ].map(c=>(
              <label key={c.k} className="flex items-center gap-3 p-3 rounded-xl bg-surface border">
                <c.icon className="w-4 h-4"/><span className="text-sm font-bold flex-1">{c.label}</span>
                <input type="checkbox" checked={prefs[c.k as keyof typeof prefs]} onChange={e=>setPrefs({...prefs, [c.k]:e.target.checked})} className="w-5 h-5 accent-ink"/>
              </label>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b font-bold">Centre</div>
          <div className="divide-y">
            {list.map(n=>(
              <div key={n.id} className={`p-4 flex gap-3 ${n.read?'':'bg-amber-50'}`}>
                <div className="w-10 h-10 rounded-full bg-ink text-white grid place-items-center text-xs">{n.channel[0]}</div>
                <div className="flex-1"><div className="text-sm font-bold">{n.title}</div><div className="text-sm text-slate-600">{n.body}</div><div className="text-xs text-slate-400"><RelativeTime date={n.date} locale={locale} /></div></div>
                <button onClick={()=>setList(list.map(x=>x.id===n.id? {...x, read:!x.read}:x))} className="text-xs font-bold text-primary">{n.read?'Marquer non lu':'Marquer lu'}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
