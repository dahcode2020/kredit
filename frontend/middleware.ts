import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
const locales = ["fr","en","nl","de"];
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname.includes(".") ) return NextResponse.next();
  const hasLocale = locales.some(l => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (!hasLocale) {
    const accept = req.headers.get("accept-language") || "";
    let locale = "fr";
    if (accept.includes("nl")) locale = "nl";
    else if (accept.includes("de")) locale = "de";
    else if (accept.includes("en")) locale = "en";
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)"] };
