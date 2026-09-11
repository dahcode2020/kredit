"use client";
import { useEffect, useState, useCallback } from "react";

export function useSWUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker.register('/sw.js').then(r => {
      reg = r;
      setRegistration(r);
      // Check for waiting on load
      if (r.waiting) {
        setWaitingWorker(r.waiting);
        setUpdateAvailable(true);
      }
      r.addEventListener('updatefound', () => {
        const nw = r.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(nw);
            setUpdateAvailable(true);
          }
        });
      });
    }).catch(() => {});

    // Detect controller change (new SW activated)
    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Periodic check every 60s
    const id = setInterval(() => reg?.update().catch(()=>{}), 60_000);

    // Listen to SW messages
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SKIP_WAITING') {
        // handled
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage as any);

    return () => {
      clearInterval(id);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.removeEventListener('message', onMessage as any);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }, [waitingWorker]);

  return { updateAvailable, applyUpdate, registration };
}
