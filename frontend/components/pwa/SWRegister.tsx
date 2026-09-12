"use client";
import { useEffect } from "react";

/**
 * Enregistrement du service worker.
 *
 * Jamais actif en développement: le serveur de dev sert `/_next/static/chunks/webpack.js`
 * (et toute la famille sans hash de build) sur une URL stable, réécrite à chaque compilation.
 * Un worker qui met ces réponses en cache (CacheFirst sur `/\_next/static/`) ressert un runtime
 * webpack pendant que les chunks viennent d'une compile plus récente: la table des modules ne
 * correspond plus et le navigateur lève « TypeError: Cannot read properties of undefined
 * (reading 'call') » dans `options.factory`. Le composant profite en plus du nettoyage pour
 * réparer les postes déjà partis en cache (un `caches.delete` + `unregister` au prochain
 * chargement suffit ensuite à repartir propre).
 */
export default function SWRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      // Auto-guérison: on désenregistre et on vide les caches kredit-* laissés par une
      // session de prod ou par une version précédente de ce composant.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          if (!regs.length) return;
          return Promise.all(regs.map((r) => r.unregister()));
        })
        .catch(() => {});
      if (typeof caches !== 'undefined') {
        caches
          .keys()
          .then((keys) =>
            Promise.all(keys.filter((k) => k.startsWith('kredit-')).map((k) => caches.delete(k)))
          )
          .catch(() => {});
      }
      return;
    }

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // Periodic update check
        setInterval(() => reg.update().catch(()=>{}), 60 * 60 * 1000);
        // Handle updates
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available — UpdatePrompt will show
              window.dispatchEvent(new CustomEvent('kredit:sw-update'));
            }
          });
        });
      } catch (e) {
        console.warn('SW register failed', e);
      }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
