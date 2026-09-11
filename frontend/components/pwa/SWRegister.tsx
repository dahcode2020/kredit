"use client";
import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
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
