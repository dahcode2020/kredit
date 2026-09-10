import "./globals.css";
export const metadata = {
  title: "KREDIT — Plateforme Européenne de Crédit & Investissement",
  description: "Belgique • EUR • FR/EN/NL/DE • Simulation indicative, décision humaine, audit immuable.",
  manifest: "/manifest.json",
  themeColor: "#0F1115",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
