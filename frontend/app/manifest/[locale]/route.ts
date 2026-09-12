import { buildManifest } from "@/lib/pwa-manifest";
import { locales, type Locale } from "@/lib/i18n";
import { isSupportedLocale } from "@/lib/locale-detection";

/**
 * Manifeste PWA par locale (voir `lib/pwa-manifest.ts` pour le pourquoi). Statique par locale :
 * le contenu ne dépend que du dictionnaire, pas de la requête, et `generateStaticParams` fournit les
 * quatre variantes au build — d'où l'URL sans extension (`/manifest/nl`), alignée sur le prerender.
 * Le type déclaré est `application/manifest+json`, ce qui suffit au navigateur.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const HEADERS = {
  "Content-Type": "application/manifest+json; charset=utf-8",
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  "X-Robots-Tag": "noindex",
};

export async function GET(_req: Request, { params }: { params: { locale: string } }) {
  if (!isSupportedLocale(params.locale)) {
    return new Response(JSON.stringify({ error: "unsupported_locale" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(JSON.stringify(buildManifest(params.locale as Locale), null, 2), {
    status: 200,
    headers: HEADERS,
  });
}
