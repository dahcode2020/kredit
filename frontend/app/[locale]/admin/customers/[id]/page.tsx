"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { mockCustomers, mockAdminApps } from "@/lib/mockAdmin";
import { ShieldCheck, FileText, CreditCard, AlertTriangle } from "lucide-react";
import Link from "next/link";
export default function Page({ params }: { params:{locale:string, id:string}}) {
  const locale = params.locale as Locale;
  const c = mockCustomers.find(x=>x.id===params.id) || mockCustomers[0];
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="max-w-[900px] space-y-6">
        <div className="flex gap-3 items-center"><div className="w-12 h-12 rounded-full bg-ink text-white grid place-items-center font-bold">{c.name[0]}</div><div><h1 className="text-[20px] font-extrabold">{c.name} • {c.id}</h1><p className="text-sm text-slate-500">{c.email} • KYC {c.kyc} • Risque {c.risk} • {c.country}</p></div><span className="ml-auto px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border text-xs font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> MFA ✓</span></div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border p-4"><div className="text-xs tracking-widest uppercase font-bold text-slate-500">Dossiers</div><div className="text-xl font-extrabold">{c.dossiers}</div><Link href={`/${locale}/admin/credit-applications?customer=${c.id}`} className="text-xs font-bold text-primary">Voir →</Link></div>
          <div className="bg-white rounded-2xl border p-4"><div className="text-xs tracking-widest uppercase font-bold text-slate-500">KYC</div><div className="font-bold">{c.kyc} • itsme® 08/09</div><div className="text-xs text-slate-500">PEP clean • liveness 0.98</div></div>
          <div className="bg-white rounded-2xl border p-4"><div className="text-xs tracking-widest uppercase font-bold text-slate-500">Paiements</div><div className="font-bold">2 confirmés</div><Link href={`/${locale}/admin/payments?customer=${c.id}`} className="text-xs font-bold text-primary">Voir →</Link></div>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-bold">Dossiers du client</h3>
          <div className="mt-3 space-y-2">
            {mockAdminApps.slice(0,2).map(a=>(
              <Link key={a.id} href={`/${locale}/admin/credit-applications/${a.id}`} className="flex justify-between p-3 rounded-xl bg-surface border hover:bg-white">
                <div><div className="font-mono text-xs font-bold">{a.id} • {a.product}</div><div className="text-xs text-slate-500">{a.amount}€ • {a.status} • {a.grade}</div></div>
                <span className="text-xs font-bold text-primary">Examiner</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4"/> Documents & audit</h3>
          <div className="text-sm text-slate-600 mt-2">ID VERIFIED, INCOME_3M VERIFIED, PROOF_ADDRESS PENDING — ClamAV OK. Audit 12 entrées.</div>
          <div className="flex gap-2 mt-3"><button className="h-9 px-4 rounded-full border text-xs font-bold">Bloquer client</button><button className="h-9 px-4 rounded-full bg-ink text-white text-xs font-bold">Relancer KYC</button></div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-xs"><AlertTriangle className="w-4 h-4 text-amber-600"/> Toute action → audit_logs hash-chaîné.</div>
      </div>
    </AdminShell>
  );
}
