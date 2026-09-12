"use client";
/**
 * La mascotte du portail — une carte bancaire qui a des yeux, et qui vous regarde.
 *
 * Ce n'est pas un ornement jeté là pour « faire sympa » : l'écran d'authentification d'un produit
 * de crédit est celui où l'on hésite, où l'on se trompe de mot de passe, où l'on referme l'onglet. Un
 * visage qui réagit (les pupilles suivent le pointeur, la carte flotte doucement) rend l'attente moins
 * froide sans rien demander au visiteur.
 *
 * Zéro image, zéro requête : un SVG dessiné ici, animé par les utilitaires de `app/globals.css`
 * (`.motion-float`, `.spot`), donc il obéit à `prefers-reduced-motion` comme le reste du site — y
 * compris les pupilles, dont la translation est neutralisée par la même règle que les survols.
 */
import { useSpotlight } from "@/lib/motion";
import { cn } from "@/lib/utils";

export default function Mascotte({ className, moral = "serein" }: { className?: string; moral?: "serein" | "content" | "attentif" }) {
  const ref = useSpotlight<HTMLDivElement>();

  return (
    <div ref={ref} data-mascotte="" data-moral={moral} className={cn("spot relative w-[188px] motion-float", className)}>
      <svg viewBox="0 0 188 122" role="img" aria-hidden="true" className="w-full h-auto drop-shadow-[0_18px_36px_rgba(0,0,0,.42)]">
        <defs>
          <linearGradient id="kred-corps" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="58%" stopColor="#F3F4F6" />
            <stop offset="100%" stopColor="#D1D5DB" />
          </linearGradient>
          <linearGradient id="kred-puce" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFB27A" />
            <stop offset="100%" stopColor="#FF4A17" />
          </linearGradient>
        </defs>
        <rect x="4" y="10" width="180" height="102" rx="18" fill="url(#kred-corps)" />
        <rect x="4" y="10" width="180" height="102" rx="18" fill="none" stroke="rgb(15 17 21 / .10)" />
        <rect x="22" y="30" width="34" height="24" rx="6" fill="url(#kred-puce)" />
        <path d="M30 42h18M39 34v16" stroke="rgb(255 255 255 / .72)" strokeWidth="2.2" strokeLinecap="round" />
        <g className="kred-oeil">
          <ellipse cx="98" cy="52" rx="12" ry="13" fill="#0F1115" opacity=".08" />
          <circle cx="98" cy="52" r="9.5" fill="#fff" stroke="rgb(15 17 21 / .16)" />
          <circle className="kred-pupille" cx="98" cy="52" r="4.4" fill="#0F1115" />
        </g>
        <g className="kred-oeil">
          <ellipse cx="130" cy="52" rx="12" ry="13" fill="#0F1115" opacity=".08" />
          <circle cx="130" cy="52" r="9.5" fill="#fff" stroke="rgb(15 17 21 / .16)" />
          <circle className="kred-pupille" cx="130" cy="52" r="4.4" fill="#0F1115" />
        </g>
        <path
          className="kred-bouche"
          d="M100 76c6 6 16 6 22 0"
          fill="none"
          stroke="#0F1115"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="22" y="88" width="52" height="6" rx="3" fill="rgb(15 17 21 / .14)" />
        <rect x="22" y="98" width="30" height="6" rx="3" fill="rgb(15 17 21 / .10)" />
      </svg>
    </div>
  );
}
