import { Locale } from "@/lib/i18n";
import I18nShowcase from "@/components/examples/I18nShowcase";

export default function Page({ params }: { params:{locale:string}}) {
  const locale = params.locale as Locale;
  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-[1280px] px-6 py-8">
        <h1 className="text-[24px] font-extrabold">i18n — Exemple complet (FR/EN/NL/DE)</h1>
        <p className="text-sm text-slate-500">Détection: 1) cookie NEXT_LOCALE / JWT / localStorage 2) Accept-Language 3) fr — persistance 1y — fr-BE override — Intl formats</p>
        <div className="mt-6">
          <I18nShowcase locale={locale} />
        </div>
        <div className="mt-8 bg-white rounded-2xl border p-6">
          <h3 className="font-bold">Comment utiliser (zéro hard-code)</h3>
          <pre className="mt-2 bg-ink text-white p-4 rounded-xl text-xs overflow-auto">{`"use client";
import { useTranslation } from "@/hooks/useTranslation";
export function MyButton() {
  const { t } = useTranslation("credit");
  return <button>{t("simulator.request")}</button>; // jamais "Déposer ma demande"
}
// Formats
import { formatCurrency, formatDate, formatPhoneBE } from "@/lib/formatters";
formatCurrency(15000, locale) // 15 000,00 € (fr-BE) vs €15,000.00 (en-BE)
formatDate(new Date(), locale) // 09/09/2026 vs 09-09-2026
formatPhoneBE("+32470123456", locale) // +32 470 12 34 56
`}</pre>
        </div>
      </div>
    </div>
  );
}
