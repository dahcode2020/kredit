/** @type {import('next').NextConfig} */
const nextConfig = {
  // Le dev n'écrit PAS dans le même dossier que `next build`. Partager un `.next` entre les deux
  // est la manière la plus fiable de produire exactement la panne « lit de webpack figé »: le build
  // de production remplace les chunks que le serveur de dev a en mémoire, le HTML servi référence
  // alors des identifiants de modules que le runtime chargé ne connaît pas -> « Cannot read
  // properties of undefined (reading 'call') » dans `options.factory`, réplicable à merci par un
  // rechargement, avec un serveur pourtant tout vert et tous ses fichiers à 200. Ici: `next dev`
  // compile dans `.next-dev`, `next build`/`next start` dans `.next`. (Un NODE_ENV=production forcé
  // avec `next dev` retomberait sur `.next`: c'est le seul cas où l'isolation saute.)
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev",
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  images: {
    // En dev seulement: le composant passe par /_next/image, qui relaie l'appel distant
    // depuis le serveur. Hors du réseau (sandbox, CI, poste derrière un proxy qui bloque
    // images.unsplash.com), chaque visuel répond 500 et Next affiche une overlay d'erreur
    // par-dessus une page pourtant correcte. En production l'optimisation serveur reste active.
    unoptimized: process.env.NODE_ENV !== "production",
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }, { protocol: "https", hostname: "i.pravatar.cc" }],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // SW must never be cached
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              // En dev, ces URLs sont stables et réécrites à chaque compile: les déclarer
              // « immutable » autorise le cache (navigateur, puis service worker) à figer un
              // runtime webpack périmé -> « reading 'call' » au premier reload après un rebuild.
              source: "/_next/static/:path*",
              headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
            },
          ]
        : []),
    ];
  },
  // Redirects: ensure offline is reachable
  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
