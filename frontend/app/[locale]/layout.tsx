import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { Locale, locales, defaultLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  const locale = (locales as readonly string[]).includes(params.locale) ? (params.locale as Locale) : defaultLocale;
  if (!locales.includes(locale as any)) notFound();
  return (
    <>
      <Header locale={locale} />
      <main className="pt-[72px]">{children}</main>
      <Footer locale={locale} />
      <script dangerouslySetInnerHTML={{ __html: `
        if('serviceWorker' in navigator){ window.addEventListener('load',()=>{ navigator.serviceWorker.register('/sw.js'); });}
      `}} />
    </>
  );
}
