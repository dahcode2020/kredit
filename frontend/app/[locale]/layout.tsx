import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HtmlLang, { HtmlLangScript } from "@/components/layout/HtmlLang";
import { Locale, locales, defaultLocale, openGraphLocale } from "@/lib/i18n";
import { SITE_ORIGIN, SITE_NAME, ogImages } from "@/lib/seo";
import { notFound } from "next/navigation";
import ConnectivityStatus from "@/components/pwa/ConnectivityStatus";
import { OfflineBanner } from "@/components/pwa/OfflineNotice";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import UpdatePrompt from "@/components/pwa/UpdatePrompt";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Métadonnées par langue — dérivées du segment `[locale]`, jamais d'une valeur par défaut.
 *
 * Le layout racine ne reçoit pas les params: y écrire `canonical: "/fr"` ou `locale: "fr_BE"`
 * envoyait le même canonical aux quatre langues (canonicalisation croisée = /en, /nl, /de
 * écartés de l'index) et un `og:locale` que le parseur Open Graph refuse (`fr_BE` n'est pas dans
 * son énumération). `openGraphLocale` (lib/i18n.ts) fournit le tag reconnu, un seul endroit.
 */
export function generateMetadata({ params }: { params: { locale: string } }) {
  const locale = (locales as readonly string[]).includes(params.locale) ? (params.locale as Locale) : defaultLocale;
  return {
    metadataBase: new URL(SITE_ORIGIN),
    alternates: {
      canonical: `/${locale}`,
      // hreflang: chaque langue pointe sa propre racine, plus `x-default` vers la locale par défaut
      languages: Object.fromEntries([...locales.map((l) => [l, `/${l}`]), ["x-default", `/${defaultLocale}`]]),
    },
    // Bloc **complet** : Next remplace `openGraph` au lieu de le fusionner, donc une déclaration
    // partielle ferait disparaître `og:image`, `og:site_name` et `og:type`.
    openGraph: {
      title: "KREDIT — Crédit & Investissement (BE)",
      description: "Simulation indicative, décision humaine, audit immuable. PWA installable.",
      url: `${SITE_ORIGIN}/${locale}`,
      siteName: SITE_NAME,
      type: "website",
      locale: openGraphLocale[locale],
      alternateLocales: locales.filter((l) => l !== locale).map((l) => openGraphLocale[l]),
      images: ogImages,
    },
    robots: { index: true, follow: true },
  };
}

export default function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const locale = (locales as readonly string[]).includes(params.locale) ? (params.locale as Locale) : defaultLocale;
  if (!locales.includes(locale as any)) notFound();
  return (
    <>
      {/* <html lang>/<dir>: corrigé au parsing (chargement complet) puis à chaque navigation (HtmlLang) */}
      <HtmlLangScript locale={locale} />
      <HtmlLang locale={locale} />
      <Header locale={locale} />
      {/* Connectivity status — ONLINE / OFFLINE / SYNCING (valeur client-only résolue en effect) */}
      <div className="fixed top-[72px] inset-x-0 z-40 pointer-events-none">
        <div className="mx-auto max-w-[1280px] px-6 py-2 flex justify-end pointer-events-auto">
          <ConnectivityStatus />
        </div>
      </div>
      <OfflineBanner />
      <UpdatePrompt />
      <main id="main" className="pt-[72px] min-h-[60vh]">{children}</main>
      <Footer locale={locale} />
      <InstallPrompt />
    </>
  );
}
