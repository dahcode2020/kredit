"use client";
import { Badge } from "@/components/ui/Button";
import { Settings, Globe, Percent, FileText, Shield, Database, Bell, AlertTriangle, Lock } from "lucide-react";
import { useState } from "react";
import { EFFECTIF_DEPUIS, PALIERS_TAUX, PRODUITS, PRODUCT_TYPES } from "@/lib/credit-engine";
import { formatMontantCompact, formatPercent } from "@/lib/formatters";
import { Locale, locales, t } from "@/lib/i18n";
export default function SuperPage({ params }: { params: { locale: string } }){
  const locale = (locales as readonly string[]).includes(params.locale) ? (params.locale as Locale) : "fr";
  // Le champ « TAEG » de cet écran de config partait de 3.25 en dur: la valeur du 1er palier,
  // lue dans la grille (un écran d'édition qui pré-remplit un taux périmé fait publier un taux périmé).
  const [taeg, setTaeg] = useState((PALIERS_TAUX[0].taux * 100).toFixed(2));
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <Badge>SUPER_ADMIN • Configuration sensible</Badge>
        <h1 className="text-[28px] font-extrabold text-ink mt-2">Configuration globale — Belgique (BE)</h1>
        <p className="text-sm text-slate-500">Seul SUPER_ADMIN peut modifier taux, règles, pays, intégrations. Chaque changement est audité et versionné.</p>

        <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 text-sm">
          <Lock className="w-5 h-5 text-red-600 shrink-0"/>
          <div><strong className="text-red-800">Zone sensible:</strong> toute modification déclenche audit hash-chaîné + alerte. Taux effectifs avec <em>effective_from</em>.</div>
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-bold text-ink flex items-center gap-2"><Percent className="w-4 h-4 text-primary"/> Produits & Taux (BE)</h3>
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                {PRODUCT_TYPES.map((code) => {
                  const p = PRODUITS[code];
                  // Bornes et taux lus dans la grille, plus dans un tableau de démonstration: cet
                  // écran est précisément celui où un SUPER_ADMIN est censé les voir avant de les
                  // modifier — trois lignes figées y affichaient 3,99 % — 9,99 % après le changement
                  // de grille, c'est-à-dire une configuration fantôme.
                  const mini = Math.min(...PALIERS_TAUX.filter(b => b.min <= p.max).map(b => b.taux));
                  const maxi = Math.max(...PALIERS_TAUX.filter(b => b.min <= p.max).map(b => b.taux));
                  return (
                  <div key={code} className="rounded-2xl border p-4 bg-surface">
                    <div className="font-bold text-ink">{t(locale, `products.${code.toLowerCase()}`)}</div>
                    <div className="text-xs text-slate-500">{formatMontantCompact(p.min, locale)} — {formatMontantCompact(p.max, locale)} • TAEG {formatPercent(mini, locale, 2)} — {formatPercent(maxi, locale, 2)}</div>
                    <div className="mt-3 flex gap-2">
                      <input defaultValue={(mini*100).toFixed(2)} className="w-20 h-8 rounded-lg border px-2 text-xs"/>
                      <span className="text-xs py-2">—</span>
                      <input defaultValue={(maxi*100).toFixed(2)} className="w-20 h-8 rounded-lg border px-2 text-xs"/>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-2">
                <input value={taeg} onChange={e=>setTaeg(e.target.value)} className="h-10 rounded-xl border px-3 text-sm w-32" placeholder="TAEG"/>
                <button onClick={()=> alert(`Taux mis à jour à ${taeg}% — en prod: INSERT product_rates (effective_from=now) + audit`)} className="h-10 px-5 rounded-full bg-ink text-white text-sm font-bold">Publier nouveau taux</button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Versioning: ancien taux conservé (effective_to = now -1s). Pas d&#39;écrasement.</p>
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-bold text-ink flex items-center gap-2"><FileText className="w-4 h-4 text-primary"/> Règles configurables</h3>
              <div className="mt-4 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs tracking-widest uppercase text-slate-500 border-b"><tr><th className="text-left py-2">Clé</th><th>Valeur</th><th>Dur</th><th>Juridique</th></tr></thead>
                  <tbody className="divide-y">
                    <tr><td className="py-2 font-mono text-xs">max_debt_ratio</td><td>0.33</td><td><span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs">soft</span></td><td className="text-amber-600">⚠️ à valider</td></tr>
                    <tr><td className="py-2 font-mono text-xs">min_age</td><td>18</td><td><span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs">hard</span></td><td>✓ validée</td></tr>
                    <tr><td className="py-2 font-mono text-xs">max_amount_PERSONAL_BE</td><td>50000 EUR</td><td>soft</td><td>⚠️ à valider</td></tr>
                    <tr><td className="py-2 font-mono text-xs">retention_kyc_BE</td><td>10 ans</td><td>hard</td><td>⚠️ à valider</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-3">Aucune règle en dur dans le code. Tout est en base <code className="bg-surface px-1 rounded">product_rules</code> avec <code>needs_legal_validation</code>.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-bold text-ink flex items-center gap-2"><Globe className="w-4 h-4 text-primary"/> Pays — extensible EU</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between p-3 rounded-xl bg-ink text-white"><span>BE • EUR • FR/NL/DE</span><span className="text-emerald-400">● Actif</span></div>
                <div className="flex justify-between p-3 rounded-xl bg-surface border"><span>FR • EUR • FR</span><span className="text-slate-400">Bientôt</span></div>
                <div className="flex justify-between p-3 rounded-xl bg-surface border"><span>NL • EUR • NL/EN</span><span className="text-slate-400">Bientôt</span></div>
                <button onClick={()=> alert("En prod: INSERT countries (code, currency, locales, config jsonb) — toute la plateforme est country_code-aware.")} className="w-full h-10 rounded-full border font-bold text-sm">+ Ajouter un pays</button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-bold text-ink flex items-center gap-2"><Settings className="w-4 h-4 text-primary"/> Intégrations</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between"><span>KYC (Onfido/itsme®)</span><span className="text-emerald-600">● ON</span></li>
                <li className="flex justify-between"><span>PSP Mollie SEPA</span><span className="text-emerald-600">● ON</span></li>
                <li className="flex justify-between"><span>WhatsApp Cloud</span><span className="text-slate-400">○ OFF</span></li>
                <li className="flex justify-between"><span>Email SES</span><span className="text-emerald-600">● ON</span></li>
              </ul>
              <p className="text-[11px] text-slate-400 mt-2">Feature-flag <code>integration.enabled</code> + circuit breaker. Fallback manuel si provider down.</p>
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h3 className="font-bold text-ink flex items-center gap-2"><Database className="w-4 h-4 text-primary"/> Audit & Logs</h3>
              <div className="mt-3 text-xs font-mono bg-ink text-white/80 rounded-xl p-3 overflow-auto max-h-[180px]">
                <div>{`[${EFFECTIF_DEPUIS}T00:00:00Z] SUPER_ADMIN@42 — UPDATE product_rates BE ${PALIERS_TAUX.map((palier) => `${(palier.taux * 100).toFixed(2)}%`).join("→")} (grille ${PALIERS_TAUX.length} paliers) hash:a3f9… prev:9c1e…`}</div>
                <div>[2026-09-10T09:10:01Z] ADMIN@18 — DECISION KRD-0842 APPROVED hash:7b2c…</div>
                <div>[2026-09-10T08:55:11Z] SYSTEM — SCORING KRD-0842 grade B</div>
                <div>[2026-09-10T08:54:00Z] CUSTOMER@101 — SUBMIT KRD-0842</div>
              </div>
              <button onClick={()=> alert("Export WORM S3 — en prod: SELECT * FROM audit_logs ORDER BY id")} className="mt-3 w-full h-9 rounded-full bg-white border font-bold text-xs">Exporter audit (WORM)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
