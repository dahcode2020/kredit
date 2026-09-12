import "./globals.css";
import SWRegister from "@/components/pwa/SWRegister";
import { DEV_SW_HEAL_SCRIPT } from "@/lib/dev-sw-heal";
import { SITE_ORIGIN } from "@/lib/seo";

export const metadata = {
  title: {
    // Pas de `default` ici: le titre du site est une copie à traduire, donc fournie par
    // `app/[locale]/layout.tsx` (`common:seo.title`). Une valeur dans ce layout aurait été servie
    // aux quatre langues — `<title>`, meta description et `og:title` étaient en français sur /en,
    // /nl et /de.
    template: "%s | KREDIT",
  },
  applicationName: "KREDIT",
  // `manifest` est déclaré par `app/[locale]/layout.tsx` (`/manifest/{locale}.json`) : le nom,
  // la description, `lang` et surtout les URL du manifeste dépendent de la langue du segment.
  // `public/manifest.json` reste servi (repli des PWA déjà installées + precache du SW).
  keywords: ["crédit", "Belgique", "investissement", "TAEG", "KREDIT", "PWA", "fintech", "EUR"],
  authors: [{ name: "KREDIT", url: SITE_ORIGIN }],
  creator: "KREDIT",
  publisher: "KREDIT",
  metadataBase: new URL(SITE_ORIGIN),
  // NB: `alternates` (canonical + hreflang) et le bloc `openGraph` sont délibérément absents d'ici.
  // (1) Ce layout ne reçoit pas les params du segment [locale] (vérifié en Next 14.2) : une valeur
  // écrite ici s'appliquait aux QUATRE langues — canonical `…/fr` sur /en, /nl et /de (trois langues
  // de fait écartées de l'index) et `og:locale fr_BE`, valeur refusée par le parseur Open Graph
  // (hors énumération). (2) Next ne fusionne pas `openGraph` entre parent et enfant : redéclarer le
  // bloc à moitié dans `app/[locale]/layout.tsx` faisait disparaître `og:image`, `og:site_name` et
  // `og:type`. Le bloc complet vit donc chez l'enfant, avec les constantes partagées de `lib/seo.ts`.
  // `og:title`/`og:description` retombent sur `title` et `description` ci-dessus (comportement Next).
  // Le bloc `twitter` est lui aussi déplacé dans `app/[locale]/layout.tsx` (mêmes raisons que
  // `openGraph`: Next remplace le bloc chez l'enfant, et sa copie doit être traduite).
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
    // lang est un point de départ (fr) : le layout racine ne reçoit pas les params du
    // segment [locale], donc HtmlLang (layout enfant) applique la vraie langue après hydratation.
    // suppressHydrationWarning est légitime ICI uniquement (attribut muté hors React).
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-white text-ink antialiased font-body">
        {process.env.NODE_ENV !== "production" ? (
          // Auto-réparation d'un worker hérité qui gèlerait les chunks de dev; jamais en prod.
          // Placement mesuré, pas supposé: en premier enfant de <head> comme en
          // `strategy="beforeInteractive"`, le script atterrissait en 4417/4725 du HTML servi,
          // soit APRÈS les `<script src="/_next/static/chunks/…">` injectés par Next dès 569.
          // Rien, dans un layout App Router, ne peut les précéder. Le script n'en est pas moins
          // efficace: un `<script>` classique s'exécute même si un script précédent a jeté, donc
          // le premier chargement échoue, puis celui-ci désenregistre le worker, purge les caches
          // `kredit-*` et recharge une fois (drapeau sessionStorage: aucune boucle).
          <script id="kredit-dev-sw-heal" dangerouslySetInnerHTML={{ __html: DEV_SW_HEAL_SCRIPT }} />
        ) : null}
        {/* Pas de skip-link ici : son libellé est de la copie à traduire, et ce layout ne connaît pas
            le segment [locale] (params === {}). « Aller au contenu » en dur se retrouvait donc en
            français sur /en, /nl et /de — dans le tout premier nœud focusable du document, lu par les
            lecteurs d'écran avant même l'en-tête. Il vit dans `app/[locale]/layout.tsx`. */}
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
