"use client";
import { useEffect, useState } from "react";
import { Locale } from "@/lib/i18n";
import { formatDateTime, formatDate, relativeTime, resolveDate } from "@/lib/formatters";

type Props = {
  /** `Date`, ISO avec décalage (`…+02:00`/`…Z`) ou date « jour seul » — voir `resolveDate`. */
  date: Date | string | number;
  locale: Locale;
  /**
   * Instant de référence **fourni par le serveur** (un RSC passe `Date.now()` en prop).
   * Serveur et client partent alors du même instant : le libellé relatif est identique au
   * premier rendu, donc pas de mismatch. Sans cette prop, le premier rendu affiche la date
   * absolue (déterministe des deux côtés) et bascule en relatif juste après hydratation.
   */
  now?: number;
  /** Rafraîchissement du libellé après hydratation (ms). `0` fige l'affichage. */
  intervalMs?: number;
  /** Style absolu utilisé en `title` et avant hydratation. */
  absolute?: "date" | "datetime";
  className?: string;
};

/**
 * « il y a 3 heures » sans casser l'hydratation.
 *
 * Un `Date.now()` lu dans le rendu est une cause classique de mismatch — le serveur et le
 * navigateur ne tombent jamais sur la même minute, et le serveur tourne souvent en UTC :
 * `formatRelative()` ne doit donc **jamais** être appelé dans un composant (le garde-fou
 * `relative-time-in-render` de `scripts/check-hydration.mjs` l'interdit). Ce composant reprend
 * la logique pure `relativeTime(date, now, locale)` en rendant d'abord une valeur déterministe,
 * puis en la rafraîchissant après hydratation. Le `<time>` garde `dateTime`/`title` absolus :
 * l'information ne dépend jamais du moment où le HTML a été produit.
 */
export default function RelativeTime({ date, locale, now, intervalMs = 60_000, absolute = "datetime", className }: Props) {
  const d = resolveDate(date);
  const ts = d.getTime();
  const valid = !Number.isNaN(ts);
  const iso = valid ? d.toISOString() : undefined;
  const abs = !valid ? "" : absolute === "date" ? formatDate(date, locale) : formatDateTime(date, locale);
  const [label, setLabel] = useState<string>(() => (now != null && valid ? relativeTime(date, now, locale) : abs));

  useEffect(() => {
    if (!valid) return;
    // Dépend du timestamp résolu, pas de l'objet: un parent qui recrée `new Date(...)` à chaque
    // rendu ne doit pas remettre l'intervalle à zéro.
    let alive = true;
    const tick = () => { if (alive) setLabel(relativeTime(ts, Date.now(), locale)); };
    tick();
    if (intervalMs <= 0) return () => { alive = false; };
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [ts, valid, locale, intervalMs]);

  return (
    <time dateTime={iso} title={abs} className={className}>
      {valid ? label : String(date ?? "")}
    </time>
  );
}
