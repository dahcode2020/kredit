"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import { Locale } from "@/lib/i18n";
import { mockPayments } from "@/lib/mock";
import { formatEUR2 } from "@/lib/utils";
import { Download, CreditCard } from "lucide-react";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  // locale du segment [locale] uniquement: formatEUR2 n'accepte plus un tag Intl, et
  // n'a plus de défaut « fr-BE » (un utilisateur nl/de recevait du français sans erreur).
  const eur=(v:number)=> formatEUR2(v, locale);
  return (
    <CustomerShell locale={locale}>
      <div className="space-y-6">
        <div className="flex justify-between"><div><h1 className="text-[22px] font-extrabold text-ink">Paiements</h1><p className="text-sm text-slate-500">PSP Mollie SEPA • webhooks idempotents</p></div><span className="px-3 py-1 rounded-full bg-white border text-xs font-bold">IBAN BE12 **** 1234 • Mandat MND-9c1e</span></div>
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="p-4 border-b font-bold flex items-center gap-2"><CreditCard className="w-4 h-4"/> Historique</div>
          <div className="divide-y">
            {mockPayments.map(p=>(
              <div key={p.id} className="p-4 flex flex-wrap justify-between gap-3">
                <div><div className="font-mono text-xs font-bold">{p.id} • {p.app}</div><div className="text-sm">{eur(p.amount)} • {p.method} • {p.psp}</div><div className="text-xs text-slate-500">{p.date}</div></div>
                <div className="flex items-center gap-2"><span className={`px-2 py-1 rounded-full text-xs font-bold border ${p.status==='CONFIRMED'?'bg-emerald-50 text-emerald-700': p.status==='PENDING'?'bg-amber-50 text-amber-700':'bg-red-50 text-red-700'}`}>{p.status}</span><button className="w-8 h-8 rounded-full border grid place-items-center"><Download className="w-4 h-4"/></button></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CustomerShell>
  );
}
