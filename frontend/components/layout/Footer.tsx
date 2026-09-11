"use client";
import Link from "next/link";
import { Locale, t } from "@/lib/i18n";
import { ShieldCheck, Lock, FileText, Globe } from "lucide-react";
import { useEffect, useState } from "react";

export default function Footer({ locale }: { locale: Locale }) {
  const tr = (k: string) => t(locale, k);
  // Année résolue après hydratation: `new Date()` côté serveur (UTC) et navigateur
  // (Europe/Brussels) peuvent diverger (Nouvel An) → texte différent → mismatch.
  // null au premier rendu client = rendu identique au serveur, puis mise à jour en effect.
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return (
    <footer className="bg-ink text-white/80">
      <div className="mx-auto max-w-[1280px] px-6 py-14">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4"><div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-extrabold text-white">K</div><span className="font-display font-extrabold text-white text-lg">KREDIT.</span></div>
            <p className="text-sm leading-6 text-white/60">{tr("footer.tagline")}</p>
            <div className="flex gap-2 mt-4">
              {/* Sigles réglementaires: ils n'ont pas de forme traduite (le règlement s'appelle eIDAS en
                  français, en néerlandais et en anglais), et la ligne est la même sur les quatre marchés. */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs"><ShieldCheck className="w-3.5 h-3.5"/> FSMA</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs"><Lock className="w-3.5 h-3.5"/> RGPD</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs"><FileText className="w-3.5 h-3.5"/> eIDAS</span>
            </div>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-4">{tr("footer.products")}</h4>
            <ul className="space-y-2 text-sm text-white/60">
              {/* Les liens du pied de page reprennent les noms de produits DES DICTIONNAIRES: « Crédit
                  Personnel » capitalisé en dur dans le JSX était une cinquième orthographe du produit,
                  différente de `products.personal` (« Crédit personnel ») utilisée partout ailleurs. */}
              <li><Link href="#" className="hover:text-white">{tr("products.personal")}</Link></li>
              <li><Link href="#" className="hover:text-white">{tr("products.mortgage")}</Link></li>
              <li><Link href="#" className="hover:text-white">{tr("products.business")}</Link></li>
              <li><Link href="#" className="hover:text-white">{tr("products.invest")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-4">{tr("footer.compliance")}</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li>{tr("footer.kyc")}</li>
              <li>{tr("footer.secci")}</li>
              <li>{tr("footer.audit")}</li>
              <li>{tr("footer.legalValidation")} <span className="text-amber-400">{tr("footer.required")}</span></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-4">{tr("contact.title")}</h4>
            <p className="text-sm text-white/60">{tr("footer.address")}<br/>+32 2 808 12 34<br/>hello@kredit.be</p>
            {/* Énumération des marchés servis: des codes, pas de la copie (elle reste identique partout). */}
            <p className="text-xs text-white/40 mt-3 flex items-center gap-1"><Globe className="w-3 h-3"/> FR • EN • NL • DE • EUR</p>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/10">
          <p className="text-[11px] leading-5 text-white/45">⚠️ {tr("footer.disclaimer")}</p>
          <p className="text-[11px] text-white/30 mt-3">© {year ? `${year} ` : ""}KREDIT — {tr("footer.credit")}</p>
        </div>
      </div>
    </footer>
  );
}
