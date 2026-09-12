import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// ⚠️ Import exclusif du module de détection (sans dictionnaires JSON) : le middleware tourne en
// Edge runtime. Les locales et `parseAcceptLanguage` viennent de la même source que le client,
// sinon serveur et navigateur peuvent choisir deux locales différentes → mismatch d'hydratation.
import {
  supportedLocales,
  defaultLocale,
  LOCALE_COOKIE,
  localeCookieOptions,
  isSupportedLocale,
  localeFromPath,
  parseAcceptLanguage,
  type SupportedLocale,
} from "@/lib/locale-detection";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname.includes(".") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const urlLocale = localeFromPath(pathname);

  // Locale déjà dans l'URL : elle fait foi. On la reflète dans le cookie pour les visites suivantes.
  const secure = req.nextUrl.protocol === "https:";

  if (urlLocale) {
    const res = NextResponse.next();
    if (cookieLocale !== urlLocale) {
      res.cookies.set(LOCALE_COOKIE, urlLocale, localeCookieOptions(secure));
    }
    return res;
  }

  // Pas de locale dans le chemin → hiérarchie : 1) cookie 2) Accept-Language 3) défaut
  let locale: SupportedLocale = defaultLocale;
  if (isSupportedLocale(cookieLocale)) locale = cookieLocale as SupportedLocale;
  else {
    const parsed = parseAcceptLanguage(req.headers.get("accept-language"));
    if (parsed) locale = parsed;
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const res = NextResponse.redirect(url);
  res.cookies.set(LOCALE_COOKIE, locale, localeCookieOptions(secure));
  return res;
}

/**
 * Ce matcher décide quelles requêtes **ne sont pas** traitées par la redirection de locale.
 * `manifest/` est indispensable depuis que le manifeste PWA est une route par locale
 * (`/manifest/nl`) : sans lui, le middleware réécrit `/manifest/nl` en `/nl/manifest/nl` (307) et
 * le navigateur ne récupère aucun manifeste — l'installation de la PWA échoue silencieusement.
 * (Le fichier statique `manifest.json` y était déjà, pour la même raison : le test
 * `tests/unit/i18n-metadata.spec.ts` verrouille les deux.)
 */
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|manifest/).*)"] };
