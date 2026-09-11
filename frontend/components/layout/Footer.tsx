"use client";
import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import { ShieldCheck, Lock, FileText, Globe } from "lucide-react";
import { useEffect, useState } from "react";

export default function Footer({ locale }: { locale: Locale }) {
  const tr = (k: string) => t(locale, k);
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return (
    <footer className="bg-ink text-white/80">
      <div className="mx-auto max-w-[1280px] px-6 py-14">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-extrabold text-white">K</div><span className="font-display font-extrabold text-white text-lg">KREDIT.</span></div>
            <p className="text-sm leading-6 text-white/60">Plateforme européenne de crédit & investissement. Belgique • EUR • 4 langues. Architecture configurable, audit immuable, décision humaine.</p>
            <div className="flex gap-2 mt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs"><ShieldCheck className="w-3.5 h-3.5"/> FSMA</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs"><Lock className="w-3.5 h-3.5"/> RGPD</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs"><FileText className="w-3.5 h-3.5"/> eIDAS</span>
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Produits</h4>
            <ul className="space-y-2 text-sm text-white/60"><li><Link href="#" className="hover:text-white">Crédit Personnel</Link></li><li><Link href="#" className="hover:text-white">Hypothécaire</Link></li><li><Link href="#" className="hover:text-white">Professionnel</Link></li><li><Link href="#" className="hover:text-white">Investissements</Link></li></ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Conformité</h4>
            <ul className="space-y-2 text-sm text-white/60"><li>KYC / AML (LBC/FT)</li><li>SECCI & TAEG</li><li>Audit & traçabilité</li><li>Validation juridique: <span className="text-amber-400">requise</span></li></ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-4">Contact</h4>
            <p className="text-sm text-white/60">Avenue Louise 500, 1050 Bruxelles<br/>+32 2 808 12 34<br/>hello@kredit.be</p>
            <p className="text-xs text-white/40 mt-3 flex items-center gap-1"><Globe className="w-3 h-3"/> FR • EN • NL • DE • EUR</p>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-[11px] leading-5 text-white/45">⚠️ {tr("footer.disclaimer")}</p>
          <p className="text-[11px] text-white/30 mt-3" suppressHydrationWarning>© {year ?? 2026} KREDIT — Inspiré par Dewi (Themewagon). Design system adapté fintech. PWA installable. Version 1.0 — Belgique.</p>
        </div>
      </div>
    </footer>
  );
}
