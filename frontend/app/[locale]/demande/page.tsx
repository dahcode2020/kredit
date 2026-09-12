import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FormDemande from "@/components/credit/FormDemande";
import Reveal from "@/components/motion/Reveal";
import { isSupportedLocale, locales, tNs, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Écran de dépôt de la demande: privé lui aussi (il reprend des chiffres de simulation et va mener à
 * un compte), donc non indexé, titre localisé comme le reste du site.
 */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isSupportedLocale(params.locale) ? params.locale : "fr";
  return {
    title: { absolute: tNs(locale, "auth", "demande.titre") },
    description: tNs(locale, "auth", "demande.subtitle"),
    robots: { index: false, follow: false },
  };
}

export default function Page({ params }: { params: { locale: string } }) {
  if (!isSupportedLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-[1180px] px-6 py-8 md:py-12">
        <Reveal as="div" variant="up" className="mb-5">
          <p className="text-[11px] font-bold tracking-widest uppercase text-primary">{tNs(locale, "auth", "portail")}</p>
        </Reveal>
        <FormDemande locale={locale} />
      </div>
    </div>
  );
}
