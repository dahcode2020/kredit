import { cn } from "@/lib/utils";
import React from "react";
export function Button({ variant="primary", size="md", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary"|"dark"|"ghost"|"outline"|"outline-light"; size?: "sm"|"md"|"lg" }) {
  const base = "inline-flex items-center justify-center font-semibold tracking-wide transition focus:outline-none focus:ring-2 focus:ring-primary/30";
  const variants: Record<string,string> = {
    primary: "bg-primary text-white hover:bg-primary-hover shadow-card rounded-full",
    dark: "bg-ink text-white hover:bg-ink-light rounded-full",
    ghost: "bg-white/10 text-white hover:bg-white/20 rounded-full backdrop-blur",
    outline: "border border-white/20 text-white hover:bg-white hover:text-ink rounded-full",
    "outline-light": "border border-slate-200 bg-white text-ink hover:bg-slate-50 rounded-full",
  };
  const sizes = { sm: "h-9 px-5 text-xs", md: "h-11 px-7 text-[13px]", lg: "h-[48px] px-8 text-sm" };
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full bg-primary-light text-primary text-[11px] font-bold tracking-widest px-3 py-1 uppercase", className)}>{children}</span>;
}
