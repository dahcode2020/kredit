import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["fr","en","nl","de"] as const;
type Locale = typeof locales[number];
const defaultLocale: Locale = "fr";
const COOKIE_NAME = "NEXT_LOCALE";

function parseAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const parts = header.split(",").map(s => {
    const [lang, qStr] = s.trim().split(";q=");
    const q = qStr ? parseFloat(qStr) : 1;
    const base = lang.toLowerCase().split("-")[0];
    return { base, q };
  }).sort((a,b)=> b.q - a.q);
  for (const p of parts) {
    if ((locales as readonly string[]).includes(p.base)) return p.base as Locale;
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname.includes(".") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  const cookieLocale = req.cookies.get(COOKIE_NAME)?.value as Locale | undefined;
  const hasLocale = locales.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`));

  if (hasLocale) {
    // persist the locale from URL into cookie if different (1y, Lax)
    const urlLocale = pathname.split("/")[1] as Locale;
    const res = NextResponse.next();
    if (cookieLocale !== urlLocale && locales.includes(urlLocale)) {
      res.cookies.set(COOKIE_NAME, urlLocale, { path: "/", maxAge: 31536000, sameSite: "lax" });
    }
    return res;
  }

  // No locale in path → detect hierarchy 1) cookie 2) Accept-Language 3) default
  let locale: Locale = defaultLocale;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const accept = req.headers.get("accept-language");
    const parsed = parseAcceptLanguage(accept);
    if (parsed) locale = parsed;
  }

  const url = req.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const res = NextResponse.redirect(url);
  // set cookie for next time
  res.cookies.set(COOKIE_NAME, locale, { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)"] };
