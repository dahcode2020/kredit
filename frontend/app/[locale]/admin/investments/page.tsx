"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4">
        <h1 className="text-[22px] font-extrabold text-ink">Investissements (1 200)</h1>
        <div className="bg-white rounded-2xl border p-6 text-center">
          <div className="text-2xl font-extrabold">8 000€</div><div className="text-sm text-slate-500">Portefeuille global • +3.2% YTD • Risque moyen 3/7</div>
          <div className="mt-4 grid md:grid-cols-3 gap-3 text-left">
            {['BE Green Bond','EU Equity','Cash Euro'].map(n=>(
              <div key={n} className="p-3 rounded-xl bg-surface border"><div className="font-bold text-sm">{n}</div><div className="text-xs text-slate-500">Risque 3/7</div></div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
