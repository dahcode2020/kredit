"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  return (
    <AdminShell locale={locale} role="ADMIN">
      <div className="space-y-4 max-w-[700px]">
        <h1 className="text-[22px] font-extrabold text-ink">Notifications</h1>
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-bold">Templates i18n (FR/EN/NL/DE)</h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="p-3 rounded-xl bg-surface border flex justify-between"><span>application.approved • Email</span><span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">Actif</span></div>
            <div className="p-3 rounded-xl bg-surface border flex justify-between"><span>more_info.requested • SMS</span><span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">Actif</span></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-4 text-xs text-slate-500">Orchestrateur Email SES / SMS Twilio / WhatsApp Cloud / Push — queue + retry</div>
      </div>
    </AdminShell>
  );
}
