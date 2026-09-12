/**
 * Dates, fuseau et temps relatif — quatrième famille de causes d'hydratation cassée.
 *
 * Deux règles figées ici :
 *  1. un instant ne doit jamais dépendre du fuseau du runtime (`resolveDate` ancre les chaînes
 *     « naive » sur UTC, ce que `new Date("2026-09-09 14:22")` ne garantit pas) ;
 *  2. un libellé relatif doit être calculé par une fonction PURE (`relativeTime(date, now, …)`),
 *     sinon `Date.now()` lu au render donne deux textes différents côté serveur et client.
 */
import { renderToString } from "react-dom/server";
import { act } from "react-dom/test-utils";
import { hydrateRoot, type Root } from "react-dom/client";
import RelativeTime from "@/components/ui/RelativeTime";
import { formatDate, formatDateTime, relativeTime, resolveDate } from "@/lib/formatters";

const withLocalTzForbidden = <T,>(fn: () => T): T => {
  const original = Date.prototype.getTimezoneOffset;
  // Si un formatteur demande le décalage local, il dépend de la machine: c'est exactement le bug.
  const boom: typeof original = () => {
    throw new Error("le fuseau local du runtime a été consulté pendant le rendu");
  };
  Date.prototype.getTimezoneOffset = boom;
  try {
    return fn();
  } finally {
    Date.prototype.getTimezoneOffset = original;
  }
};

describe("resolveDate — un instant = le même instant, quel que soit le runtime", () => {
  it("ancre une date-time sans décalage sur UTC (serveur UTC et navigateur +02:00 concordent)", () => {
    expect(resolveDate("2026-09-09 14:22").toISOString()).toBe("2026-09-09T14:22:00.000Z");
    expect(resolveDate("2026-09-09 14:22:31").toISOString()).toBe("2026-09-09T14:22:31.000Z");
    expect(resolveDate("2026-09-09T14:22").toISOString()).toBe("2026-09-09T14:22:00.000Z");
  });

  it("laisse les valeurs déjà déterministes (offset explicite, Z, epoch, Date)", () => {
    expect(resolveDate("2026-09-09T14:22:00+02:00").toISOString()).toBe("2026-09-09T12:22:00.000Z");
    expect(resolveDate("2026-09-09T14:22:00Z").toISOString()).toBe("2026-09-09T14:22:00.000Z");
    expect(resolveDate(0).toISOString()).toBe("1970-01-01T00:00:00.000Z");
    const d = new Date("2026-09-09T12:22:00.000Z");
    expect(resolveDate(d)).toBe(d);
  });

  it("traite « jour seul » comme une date calendaire UTC (un échéancier ne glisse pas d'un jour)", () => {
    expect(resolveDate("2026-10-01").toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(formatDate("2026-10-01", "fr")).toBe("01/10/2026");
  });

  it("ne consulte jamais le fuseau local du runtime", () => {
    expect(withLocalTzForbidden(() => resolveDate("2026-09-09 14:22").toISOString())).toBe("2026-09-09T14:22:00.000Z");
    expect(withLocalTzForbidden(() => formatDate("2026-09-09 14:22", "fr"))).toBe("09/09/2026");
    // 14:22 ancree en UTC, affichee en Europe/Brussels (timeZone force dans lib/formatters) :
    // 16:22 des deux cotes, que le serveur tourne en UTC, a Bruxelles ou a New York.
    expect(withLocalTzForbidden(() => formatDateTime("2026-09-09 14:22", "fr"))).toContain("16:22");
    expect(withLocalTzForbidden(() => formatDateTime("2026-09-09T16:22:00+02:00", "fr"))).toContain("16:22");
  });

  it("ne fait pas planter le rendu sur une valeur invalide (Intl lève RangeError)", () => {
    expect(Number.isNaN(resolveDate("pas une date").getTime())).toBe(true);
    expect(formatDate("pas une date", "fr")).toBe("");
    expect(formatDateTime(undefined as unknown as string, "fr")).toBe("");
  });
});

describe("relativeTime — fonction pure, jamais l'horloge du render", () => {
  const now = Date.parse("2026-09-09T15:00:00Z");

  it.each([
    ["à présent", "2026-09-09T15:00:00Z"],
    ["minute", "2026-09-09T14:59:00Z"],
    ["heure", "2026-09-09T14:00:00Z"],
    ["jours", "2026-09-06T15:00:00Z"],
    ["mois", "2026-06-09T15:00:00Z"],
    ["année", "2025-09-01T15:00:00Z"],
  ])("bucket %s", (_label, date) => {
    const out = relativeTime(date, now, "fr");
    expect(out).not.toBe("");
    expect(out.length).toBeGreaterThan(0);
  });

  it("le décalage ne dépend que de (date, now) passés en arguments", () => {
    const realNow = Date.now;
    Date.now = () => {
      throw new Error("Date.now() lu pendant le calcul d'un libellé rendu");
    };
    try {
      expect(relativeTime("2026-09-09T14:00:00Z", now, "fr")).toBe(relativeTime("2026-09-09T14:00:00Z", now, "fr"));
      expect(relativeTime("2026-09-09T14:00:00Z", now, "fr")).toBe("il y a 1 heure");
    } finally {
      Date.now = realNow;
    }
  });

  it("espace les mots comme le reste des formatteurs (aucun U+202F/U+2009 résiduel)", () => {
    for (const locale of ["fr", "en", "nl", "de"] as const) {
      for (const date of ["2026-09-09T14:59:00Z", "2026-09-06T15:00:00Z", "2025-01-01T15:00:00Z"]) {
        expect(relativeTime(date, now, locale)).not.toMatch(/[\u202F\u2007\u2009]/);
      }
    }
  });


  it("les dates naive et ISO équivalentes donnent le même libellé", () => {
    expect(relativeTime("2026-09-09 14:00", now, "fr")).toBe(relativeTime("2026-09-09T14:00:00Z", now, "fr"));
  });
});

describe("<RelativeTime> — HTML du serveur = premier rendu du client", () => {
  const now = Date.parse("2026-09-09T15:00:00Z");

  it("avec `now` fourni: le libellé relatif est déjà dans le HTML (aucun saut visuel)", () => {
    const html = renderToString(<RelativeTime date="2026-09-09T14:00:00Z" locale="fr" now={now} />);
    expect(html).toContain("il y a 1 heure");
    expect(html).toMatch(/datetime="2026-09-09T14:00:00\.000Z"/i);
    expect(html).toContain("<time");
  });

  it("sans `now`: le HTML ne contient que de l'absolu, donc le client ne peut pas diverger", () => {
    const html = renderToString(<RelativeTime date="2026-09-09 14:22" locale="fr" />);
    expect(html).toContain("2026");
    expect(html).not.toMatch(/il y a|dans /);
  });

  it("la date naive et sa version ISO rendent le même HTML", () => {
    expect(renderToString(<RelativeTime date="2026-09-09 14:22" locale="fr" now={now} />)).toBe(
      renderToString(<RelativeTime date="2026-09-09T14:22:00Z" locale="fr" now={now} />)
    );
  });

  it("hydrate sans erreur, puis bascule en relatif après montage", async () => {
    const el = <RelativeTime date="2026-09-09 14:22" locale="fr" intervalMs={0} />;
    const html = renderToString(el);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const problems: string[] = [];
    const spy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      problems.push(args.map(String).join(" "));
    });
    try {
      let root: Root | undefined;
      await act(async () => {
        root = hydrateRoot(container, el, { onRecoverableError: (e) => problems.push(String(e)) });
      });
      const time = container.querySelector("time")!;
      expect(time.getAttribute("datetime")).toBe("2026-09-09T14:22:00.000Z"); // jamais re-dérivé côté client
      // même texte que la fonction pure appelee avec l'horloge du moment: le composant n'invente rien
      expect(time.textContent).toBe(relativeTime("2026-09-09 14:22", Date.now(), "fr"));
      expect(problems.join("\n")).not.toMatch(/hydrat|did not match|server html|Text content/i);
      await act(async () => root?.unmount());
    } finally {
      spy.mockRestore();
      container.remove();
    }
  });

  it("une valeur invalide reste rendable (pas de RangeError, pas de trou dans l'arbre)", () => {
    const html = renderToString(<RelativeTime date="pas une date" locale="fr" now={now} />);
    expect(html).toContain("<time");
    expect(html).toContain("pas une date");
  });
});
