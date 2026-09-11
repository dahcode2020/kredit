"use client";
import { Locale } from "@/lib/i18n";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDate, formatDateTime, formatCurrency, formatPercent, formatAddressBE, formatPhoneBE, formatList } from "@/lib/formatters";

export default function I18nShowcase({ locale }: { locale: Locale }) {
  const { t: tCommon } = useTranslation("common");
  const { t: tAuth } = useTranslation("auth");
  const { t: tCredit } = useTranslation("credit");
  const { t: tAdmin } = useTranslation("admin");
  const { t: tLegal } = useTranslation("legal");

  const amount = 15000;
  const monthly = 338.62;
  const taeg = 0.0421;
  const date = new Date("2026-09-09T14:22:00+02:00");
  const address = { street: "Rue de la Loi", number: "100", box: "5", postal: "1000", city: "Bruxelles" };
  const phone = "+32470123456";

  return (
    <div className="space-y-6 max-w-[900px]">
      {/* Bandeau de démonstration de l’API i18n: ses libellés viennent des dictionnaires, ses fixtures
          (rue, téléphone, comparaison « Rue vs Wetstraat ») restent des DONNÉES de démonstration. */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        {tCommon("examples.bannerLead")} <code className="bg-white px-1 rounded">t(locale, &#34;ns:key&#34;)</code> {tCommon("examples.bannerMid")} <code>NEXT_LOCALE</code> {tCommon("examples.bannerTail")}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-bold text-sm">{tCommon("examples.sectionCommon")}</h3>
          <ul className="text-sm mt-2 space-y-1">
            <li>{tCommon("nav.home")} / {tCommon("nav.simulator")} / {tCommon("nav.products")}</li>
            <li>{tCommon("footer.disclaimer").slice(0,80)}…</li>
          </ul>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <h3 className="font-bold text-sm">{tCommon("examples.sectionAuth")}</h3>
          <ul className="text-sm mt-2 space-y-1">
            <li>{tAuth("title")}</li>
            <li>{tAuth("email.label")}: vous@exemple.be</li>
            <li>{tAuth("mfa.required")}</li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-bold">{tCredit("simulator.title")}</h3>
        <p className="text-sm text-slate-600">{tCredit("simulator.subtitle")}</p>
        <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
          <div className="p-3 rounded-xl bg-surface border"><div className="text-xs uppercase tracking-widest font-bold text-slate-500">{tCredit("simulator.amount")}</div><div className="font-bold">{formatCurrency(amount, locale)}</div></div>
          <div className="p-3 rounded-xl bg-surface border"><div className="text-xs uppercase tracking-widest font-bold text-slate-500">{tCredit("simulator.monthly")}</div><div className="font-bold">{formatCurrency(monthly, locale)}</div></div>
          <div className="p-3 rounded-xl bg-surface border"><div className="text-xs uppercase tracking-widest font-bold text-slate-500">{tCredit("simulator.taeg")}</div><div className="font-bold">{formatPercent(taeg, locale)}</div></div>
        </div>
        <p className="text-xs text-slate-500 mt-3">{tLegal("disclaimer.simulation")}</p>
        <p className="text-xs text-slate-400 mt-1">{formatDate(date, locale)} • {formatDateTime(date, locale)} • {formatList([tCommon("products.personal"), tCommon("products.mortgage"), tCommon("products.business.tag")], locale)}</p>
        <p className="text-xs mt-2">📍 {formatAddressBE(address, locale)} • 📞 {formatPhoneBE(phone, locale)} — {tCredit("documents.count", { count: 1 })} / {tCredit("documents.count", { count: 3 })}</p>
      </div>

      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-bold">{tCommon("examples.sectionAdmin")}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">{tAdmin("decision.approve")}</span>
          <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold">{tAdmin("decision.approveWithException")}</span>
          <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold">{tAdmin("decision.reject")}</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">{tAdmin("decision.reason")}: {tAdmin("decision.reasonPlaceholder")}</p>
      </div>

      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-bold text-sm">Formats locaux — {locale} </h3>
        <table className="w-full text-xs mt-2">
          <tbody className="divide-y">
            <tr><td className="py-2 font-bold">{tCommon("examples.formatDate")}</td><td>{formatDate(date, locale)}</td><td className="text-slate-500">Intl.DateTimeFormat{/* check-copy:ignore */}</td></tr>
            <tr><td className="py-2 font-bold">{tCommon("examples.formatMoney")}</td><td>{formatCurrency(15000, locale)}</td><td className="text-slate-500">EUR</td></tr>
            <tr><td className="py-2 font-bold">{tCommon("examples.formatPercent")}</td><td>{formatPercent(0.384, locale)}</td><td className="text-slate-500">38,4 % vs 38.4%{/* check-copy:ignore */}</td></tr>
            <tr><td className="py-2 font-bold">{tCommon("examples.formatAddress")}</td><td>{formatAddressBE(address, locale)}</td><td className="text-slate-500">Rue vs Wetstraat{/* check-copy:ignore */}</td></tr>
            <tr><td className="py-2 font-bold">{tCommon("examples.formatPhone")}</td><td>{formatPhoneBE(phone, locale)}</td><td className="text-slate-500">+32 470…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
