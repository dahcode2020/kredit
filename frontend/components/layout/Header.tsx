"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, Globe, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Locale, locales, t, setPersistedLocale } from "@/lib/i18n";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConnectivityDot } from "@/components/pwa/ConnectivityStatus";

export default function Header({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const switchLocale = (l: Locale) => {
    setPersistedLocale(l);
    const parts = pathname.split("/");
    parts[1] = l;
    router.push(parts.join("/") || `/${l}`);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) fetch(`${apiUrl}/api/v1/customers/me/preferences`, { method: "PATCH", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ locale: l }) }).catch(()=>{});
  };
  const tr = (k: string) => t(locale, k);
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-ink/95 backdrop-blur border-b border-white/5">
      <div className="mx-auto max-w-[1280px] px-6 h-[72px] flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-extrabold text-sm">K</div>
          <span className="text-white font-display font-extrabold tracking-tight text-[22px]">KREDIT<span className="text-primary">.</span></span>
          <span className="hidden md:inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[10px] font-bold tracking-widest uppercase border border-white/10">
            <Shield className="w-3 h-3" /> BE • EUR
          </span>
          <span className="hidden lg:inline-flex ml-2"><ConnectivityDot /></span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          <Link href={`/${locale}#simulateur`} className="nav-link">{tr("nav.simulator")}</Link>
          <Link href={`/${locale}#produits`} className="nav-link">{tr("nav.products")}</Link>
          <Link href={`/${locale}#services`} className="nav-link">{tr("nav.invest")}</Link>
          <Link href={`/${locale}#about`} className="nav-link">{tr("nav.about")}</Link>
          <Link href={`/${locale}#contact`} className="nav-link">{tr("nav.contact")}</Link>
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/10 rounded-full p-1 border border-white/10">
            {locales.map(l => (
              <button key={l} onClick={() => switchLocale(l)} className={cn("w-8 h-7 rounded-full text-[11px] font-bold uppercase transition", locale===l ? "bg-white text-ink shadow" : "text-white/70 hover:text-white")}>{l}</button>
            ))}
          </div>
          <Link href={`/${locale}#auth`} className="text-white/90 hover:text-white text-[13px] font-semibold"> {tr("nav.login")} </Link>
          <Link href={`/${locale}#simulateur`}><Button size="md" className="!h-10">{tr("nav.cta")}</Button></Link>
        </div>

        <button onClick={() => setOpen(!open)} className="lg:hidden w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10">
          {open ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-ink border-t border-white/10 px-6 py-6 space-y-4">
          <div className="flex gap-2">
            {locales.map(l => (
              <button key={l} onClick={() => switchLocale(l)} className={cn("flex-1 h-9 rounded-full text-xs font-bold uppercase", locale===l ? "bg-white text-ink" : "bg-white/10 text-white")}>{l.toUpperCase()}</button>
            ))}
          </div>
          <Link href={`/${locale}#simulateur`} onClick={()=>setOpen(false)} className="block nav-link py-2">{tr("nav.simulator")}</Link>
          <Link href={`/${locale}#produits`} onClick={()=>setOpen(false)} className="block nav-link py-2">{tr("nav.products")}</Link>
          <Link href={`/${locale}#contact`} onClick={()=>setOpen(false)} className="block nav-link py-2">{tr("nav.contact")}</Link>
          <Button className="w-full mt-2" onClick={()=>setOpen(false)}>{tr("nav.cta")}</Button>
        </div>
      )}
    </header>
  );
}
