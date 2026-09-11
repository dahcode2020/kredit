"use client";
import CustomerShell from "@/components/customer/CustomerShell";
import Simulator from "@/components/credit/Simulator";
import { Locale } from "@/lib/i18n";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  return (
    <CustomerShell locale={locale}>
      <div className="space-y-4">
        <div><h1 className="text-[22px] font-extrabold text-ink">Simulateur</h1><p className="text-sm text-slate-500">8 champs → {`{simulation, eligibility, score, recommendation, warnings, requiredDocuments}`}</p></div>
        <Simulator locale={locale} />
      </div>
    </CustomerShell>
  );
}
