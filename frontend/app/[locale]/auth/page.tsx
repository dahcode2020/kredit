import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormulaireAuth from "@/components/auth/FormulaireAuth";
import Reveal from "@/components/motion/Reveal";
import { isSupportedLocale, locales, t, tNs, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Titre et description localisés, comme le reste du site — la page est publique (on doit pouvoir la
 * partager à un client), mais elle ne doit pas être indexée : une page de connexion dans un index est
 * une porte d'entrée offerte aux attaques par mots de passe, et elle ne contient rien à lire.
 */
export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale: Locale = isSupportedLocale(params.locale) ? params.locale : "fr";
  return {
    title: { absolute: tNs(locale, "auth", "title") },
    description: tNs(locale, "auth", "subtitle"),
    robots: { index: false, follow: false },
  };
}

export default function Page({ params }: { params: { locale: string } }) {
  if (!isSupportedLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  return (
    <div className="relative bg-surface">
      {/* Le layout pose déjà <main id="main">: un second <main> ici serait une imbrication invalide
          (le garde-fou check:dom-nesting la refuserait, à juste titre). */}
      <div className="mx-auto max-w-[1180px] px-6 py-8 md:py-12">
        <FormulaireAuth locale={locale} />
        <Reveal as="div" variant="fade" retard={120} className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-slate-500">
          <Link href={`/${locale}#simulateur`} className="font-bold text-ink hover:text-primary transition">
            {t(locale, "nav.simulator")}
          </Link>
          <Link href={`/${locale}/demande`} className="font-bold text-ink hover:text-primary transition">
            {tNs(locale, "auth", "demande.titre")}
          </Link>
          <span className="text-slate-400">{t(locale, "roles.demoNote")}</span>
        </Reveal>
      </div>
    </div>
  );
}
