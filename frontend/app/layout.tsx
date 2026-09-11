import "./globals.css";
import SWRegister from "@/components/pwa/SWRegister";

export const metadata = {
  title: {
    default: "KREDIT — Plateforme Européenne de Crédit & Investissement",
    template: "%s | KREDIT",
  },
  description: "Belgique • EUR • FR/EN/NL/DE • Simulation indicative, décision humaine, audit immuable. PWA installable, hors ligne sécurisé.",
  applicationName: "KREDIT",
  manifest: "/manifest.json",
  keywords: ["crédit", "Belgique", "investissement", "TAEG", "KREDIT", "PWA", "fintech", "EUR"],
  authors: [{ name: "KREDIT", url: "https://kredit.be" }],
  creator: "KREDIT",
  publisher: "KREDIT",
  metadataBase: new URL("https://kredit.be"),
  alternates: {
    canonical: "/fr",
    languages: { fr: "/fr", en: "/en", nl: "/nl", de: "/de" },
  },
  openGraph: {
    title: "KREDIT — Crédit & Investissement (BE)",
    description: "Simulation indicative, décision humaine, audit immuable. PWA installable.",
    url: "https://kredit.be/fr",
    siteName: "KREDIT",
    locale: "fr_BE",
    type: "website",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "KREDIT" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "KREDIT — Plateforme Européenne",
    description: "Belgique • EUR • FR/EN/NL/DE",
    images: ["/icons/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-72.png", sizes: "72x72" },
      { url: "/icons/icon-192.png", sizes: "192x192" },
      { url: "/icons/icon-512.png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "KREDIT",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  category: "finance",
};

export const viewport = {
  themeColor: "#0F1115",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-white text-ink antialiased font-body" suppressHydrationWarning>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-ink text-white px-4 py-2 rounded-full z-[100]">Aller au contenu</a>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
