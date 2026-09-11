"use client";
import AdminShell from "@/components/admin/AdminShell";
import { Locale } from "@/lib/i18n";
import { useTranslation } from "@/hooks/useTranslation";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useState } from "react";
import { Mail, MessageSquare, Smartphone, Bell, Search, Eye, Play, Copy, ShieldCheck, Globe } from "lucide-react";

type Template = { event: string; channel: 'EMAIL'|'SMS'|'WHATSAPP'|'PUSH'; locale: Locale; subject: string | null; body: string; hsm: string | null; status: 'Actif'|'Brouillon'|'Approuvé Meta ✓'| 'Rejeté' };

const mockTemplates: Template[] = [
  { event:'APPLICATION_APPROVED', channel:'EMAIL', locale:'fr', subject:'Votre crédit KRD-{{id}} est approuvé — contrat prêt', body:'Bonjour {{name}}, votre demande {{id}} ({{amount}} sur {{term}} mois) a été approuvée. Mensualité {{monthly}} — TAEG {{taeg}}.', hsm:null, status:'Actif' },
  { event:'APPLICATION_APPROVED', channel:'EMAIL', locale:'en', subject:'Your loan KRD-{{id}} is approved — contract ready', body:'Hello {{name}}, your application {{id}} ({{amount}} over {{term}} months) has been approved.', hsm:null, status:'Actif' },
  { event:'APPLICATION_APPROVED', channel:'EMAIL', locale:'nl', subject:'Uw krediet KRD-{{id}} is goedgekeurd — contract klaar', body:'Hallo {{name}}, uw aanvraag {{id}} is goedgekeurd.', hsm:null, status:'Actif' },
  { event:'APPLICATION_APPROVED', channel:'EMAIL', locale:'de', subject:'Ihr Kredit KRD-{{id}} ist genehmigt — Vertrag bereit', body:'Hallo {{name}}, Ihr Antrag {{id}} wurde genehmigt.', hsm:null, status:'Actif' },
  { event:'PAYMENT_DUE', channel:'SMS', locale:'fr', subject:null, body:'KREDIT: echeance {{amount}} le {{date}}. Payez via {{url}}. STOP 36179', hsm:null, status:'Actif' },
  { event:'PAYMENT_DUE', channel:'SMS', locale:'en', subject:null, body:'KREDIT: payment {{amount}} due {{date}}. Pay via {{url}}. STOP 36179', hsm:null, status:'Actif' },
  { event:'APPLICATION_APPROVED', channel:'WHATSAPP', locale:'fr', subject:null, body:'Bonjour {{1}}, votre demande {{2}} est approuvée. Montant {{3}} — mensualité {{4}}. Contrat : {{5}}. — KREDIT', hsm:'kredit_approved_fr', status:'Approuvé Meta ✓' },
  { event:'APPLICATION_APPROVED', channel:'WHATSAPP', locale:'en', subject:null, body:'Hello {{1}}, your application {{2}} is approved. Amount {{3}} — monthly {{4}}. Contract: {{5}}. — KREDIT', hsm:'kredit_approved_en', status:'Approuvé Meta ✓' },
  { event:'DOCUMENT_REQUIRED', channel:'PUSH', locale:'fr', subject:'Documents manquants', body:'Votre dossier KRD-{{id}} attend {{doc}}.', hsm:null, status:'Actif' },
];

export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  // Use i18n for admin namespace — no hard-coded UI strings
  const { t } = useTranslation("admin");
  const { t: tNotif } = useTranslation("notifications");
  const [filterChannel, setFilterChannel] = useState<string>("ALL");
  const [filterLocale, setFilterLocale] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<Template | null>(null);
  // Horodatage figé à l'ouverture: le rendre avec `new Date()` dans le JSX ferait varier
  // le texte entre le rendu serveur et le rendu client (mismatch) à chaque re-render.
  const [previewAt, setPreviewAt] = useState<string>("");

  const filtered = mockTemplates.filter(m =>
    (filterChannel==="ALL" || m.channel===filterChannel) &&
    (filterLocale==="ALL" || m.locale===filterLocale) &&
    (q==="" || m.event.toLowerCase().includes(q.toLowerCase()) || m.body.toLowerCase().includes(q.toLowerCase()))
  );

  // Locale de prévisualisation = celle du template, sinon celle de la page (zéro "fr-BE" en dur)
  const previewLocale: Locale =
    preview && (["en", "nl", "de"] as string[]).includes(preview.locale) ? (preview.locale as Locale) : locale;

  return (
    <AdminShell locale={locale} role="SUPER_ADMIN">
      <div className="space-y-4 max-w-[1100px]">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-extrabold text-ink">{t("templates.title")} — Notifications</h1>
            <p className="text-sm text-slate-500">13 events × 4 canaux × 4 locales • WhatsApp HSM approuvés • persistance i18n</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white border text-xs font-bold flex items-center gap-1"><Globe className="w-3 h-3"/> 4 langues</span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> MFA ✓</span>
          </div>
        </div>

        {/* LEGAL banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <strong>Admin:</strong> EMAIL/SMS/PUSH éditables en direct. <strong>WhatsApp</strong> nécessite resoumission Meta (brouillon → approbation). Aucun secret exposé côté front.
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-surface border rounded-full px-3 h-10 flex-1 min-w-[220px]"><Search className="w-4 h-4 text-slate-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher event, body…" className="bg-transparent outline-none text-sm flex-1"/></div>
          <select value={filterChannel} onChange={e=>setFilterChannel(e.target.value)} className="h-10 rounded-full border px-3 text-sm bg-white">
            <option value="ALL">Tous canaux</option><option>EMAIL</option><option>SMS</option><option>WHATSAPP</option><option>PUSH</option>
          </select>
          <select value={filterLocale} onChange={e=>setFilterLocale(e.target.value)} className="h-10 rounded-full border px-3 text-sm bg-white">
            <option value="ALL">Toutes locales</option><option>fr</option><option>en</option><option>nl</option><option>de</option>
          </select>
          <span className="h-10 px-3 rounded-full bg-ink text-white text-xs font-bold flex items-center">{filtered.length} templates</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs tracking-widest uppercase text-slate-500 border-b bg-surface/50">
                <tr><th className="text-left p-3">Event</th><th>Canal</th><th>Locale</th><th className="text-left p-3">Sujet / Body</th><th>HSM</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((m,i)=>(
                  <tr key={i} className="hover:bg-surface/50">
                    <td className="p-3 font-mono text-xs font-bold">{m.event}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold border flex items-center gap-1 w-fit ${m.channel==='EMAIL'?'bg-blue-50 text-blue-700 border-blue-200': m.channel==='SMS'?'bg-amber-50 text-amber-700 border-amber-200': m.channel==='WHATSAPP'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-purple-50 text-purple-700 border-purple-200'}`}>{m.channel==='EMAIL'?<Mail className="w-3 h-3"/>: m.channel==='SMS'?<MessageSquare className="w-3 h-3"/>: m.channel==='WHATSAPP'?<Smartphone className="w-3 h-3"/>:<Bell className="w-3 h-3"/>}{m.channel}</span></td>
                    <td className="p-3"><span className="px-2 py-1 rounded-full bg-ink text-white text-xs font-bold">{m.locale}</span></td>
                    <td className="p-3 max-w-[420px]"><div className="font-semibold text-xs truncate">{m.subject ?? '—'}</div><div className="text-xs text-slate-600 truncate">{m.body}</div></td>
                    <td className="p-3 font-mono text-xs">{m.hsm ?? '—'}</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold border ${m.status.includes('Approuvé')?'bg-emerald-50 text-emerald-700 border-emerald-200': m.status==='Actif'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-amber-50 text-amber-700 border-amber-200'}`}>{m.status}</span></td>
                    <td className="p-3 flex gap-1">
                      <button onClick={()=>{ setPreview(m); setPreviewAt(new Date().toISOString()); }} className="h-8 px-3 rounded-full border text-xs font-bold flex items-center gap-1"><Eye className="w-3 h-3"/>{t("templates.preview")}</button>
                      <button onClick={()=>alert(`Test ${m.event} ${m.channel} ${m.locale} → queue notifications.send.${m.channel.toLowerCase()} (idempotency_key + retry)`)} className="h-8 px-3 rounded-full bg-ink text-white text-xs font-bold flex items-center gap-1"><Play className="w-3 h-3"/>{t("templates.test")}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview modal */}
        {preview && (
          <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={()=>setPreview(null)}>
            <div className="bg-white rounded-2xl border max-w-[560px] w-full p-6 space-y-4" onClick={e=>e.stopPropagation()}>
              <h3 className="font-bold">Prévisualisation — {preview.event} • {preview.channel} • {preview.locale}</h3>
              <div className="bg-surface rounded-xl p-4 space-y-2 text-sm">
                <div><strong>Sujet:</strong> {preview.subject ?? '—'}</div>
                <div><strong>Body:</strong> {preview.body}</div>
                <div className="text-xs text-slate-500">Variables: {"{{name}}"} = Alex, {"{{id}}"} = KRD-0842, {"{{amount}}"} = {formatCurrency(15000, previewLocale)}, {"{{monthly}}"} = {formatCurrency(338.62, previewLocale)}, {"{{date}}"} = {formatDate(previewAt || new Date(), previewLocale)}</div>
                <div className="text-xs text-slate-500">HSM: {preview.hsm ?? '—'} • Locale WhatsApp: {preview.locale==='en'?'en_US':preview.locale}</div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={()=>{navigator.clipboard.writeText(preview.body); alert("Copié");}} className="h-9 px-4 rounded-full border text-xs font-bold flex items-center gap-1"><Copy className="w-3 h-3"/> Copier</button>
                <button onClick={()=>setPreview(null)} className="h-9 px-4 rounded-full bg-ink text-white text-xs font-bold">Fermer</button>
              </div>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-white rounded-2xl border p-4">
          <h3 className="font-bold text-sm">Envois récents — notification_outbox</h3>
          <div className="mt-3 overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-[11px] tracking-widest uppercase text-slate-500 border-b"><tr><th className="text-left p-2">Heure</th><th>Event</th><th>Canal</th><th>Locale</th><th>Destinataire</th><th>Statut</th><th>Tentatives</th></tr></thead>
              <tbody className="divide-y">
                <tr><td className="p-2">09/09 14:22</td><td>APPLICATION_APPROVED</td><td>EMAIL</td><td>fr</td><td>alex@kredit.be (hash)</td><td><span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border text-xs">SENT</span></td><td>1</td></tr>
                <tr><td className="p-2">09/09 14:22</td><td>APPLICATION_APPROVED</td><td>WHATSAPP</td><td>fr</td><td>+32470***</td><td><span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border text-xs">DELIVERED</span></td><td>1</td></tr>
                <tr><td className="p-2">09/09 10:00</td><td>PAYMENT_DUE</td><td>SMS</td><td>nl</td><td>+32470***</td><td><span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border text-xs">PENDING (retry 2/5)</span></td><td>2</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">Idempotence: idempotency_key = event:entity:channel:locale:recipient:version • Retry exponentiel 2s/4s/8s/16s/32s • DLQ après 5 échecs.</p>
        </div>

        <div className="bg-white rounded-2xl border p-4 text-xs text-slate-500">
          Orchestrateur • Queues BullMQ `notifications.dispatch` → `notifications.send.*` • Workers • Webhooks WhatsApp/SES/Twilio • Logs append-only • jamais de secret côté front.
        </div>
      </div>
    </AdminShell>
  );
}
