import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Locale, locales, defaultLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";
import ConnectivityStatus from "@/components/pwa/ConnectivityStatus";
import { OfflineBanner } from "@/components/pwa/OfflineNotice";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import UpdatePrompt from "@/components/pwa/UpdatePrompt";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const locale = (locales as readonly string[]).includes(params.locale) ? (params.locale as Locale) : defaultLocale;
  if (!locales.includes(locale as any)) notFound();
  return (
    <>
      <Header locale={locale} />
      {/* Connectivity status — ONLINE / OFFLINE / SYNCING */}
      <div className="fixed top-[72px] inset-x-0 z-40 pointer-events-none">
        <div className="mx-auto max-w-[1280px] px-6 py-2 flex justify-end pointer-events-auto">
          <ConnectivityStatus />
        </div>
      </div>
      <OfflineBanner />
      <UpdatePrompt />
      <main suppressHydrationWarning id="main" className="pt-[72px] min-h-[60vh]">{children}</main>
      <Footer locale={locale} />
      <InstallPrompt />
    </>
  );
}
