"use client";
import { useEffect, useState, useCallback, useRef } from "react";

export function useSWUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const userRequestedRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;
    let refreshing = false;

    // Prefer existing registration to avoid duplicate register on HMR/strict-mode
    navigator.serviceWorker.getRegistration().then((existing) => {
      const doRegister = existing ? Promise.resolve(existing) : navigator.serviceWorker.register("/sw.js");
      return doRegister;
    }).then((r) => {
      reg = r;
      setRegistration(r);
      // Only prompt if there's a waiting worker AND a controller exists (i.e., update, not first install)
      if (r.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(r.waiting);
        setUpdateAvailable(true);
      }
      r.addEventListener("updatefound", () => {
        const nw = r.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            // New version installed and waiting — prompt user (not auto-activate)
            setWaitingWorker(nw);
            setUpdateAvailable(true);
          }
        });
      });
    }).catch(() => {});

    // Reload only after user explicitly requested update (SKIP_WAITING), not on every controllerchange
    const onControllerChange = () => {
      if (refreshing) return;
      // Only auto-reload if user had clicked "Actualiser" or if an update was pending and visible
      if (userRequestedRef.current || updateAvailable) {
        refreshing = true;
        window.location.reload();
      }
      // If first install (no controller before), no reload needed — just claim
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Periodic check every 5min (not 60s — less chatty, avoids "Actualiser" flicker)
    const id = setInterval(() => {
      // Use getRegistration to get fresh reg
      navigator.serviceWorker.getRegistration().then((rr) => rr?.update().catch(() => {}));
    }, 5 * 60_000);

    return () => {
      clearInterval(id);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []); // intentionally not depending on updateAvailable to avoid re-register

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    userRequestedRef.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    // Fallback: if SW doesn't respond in 2s, reload anyway
    setTimeout(() => {
      if (!document.hidden) window.location.reload();
    }, 2000);
  }, [waitingWorker]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, applyUpdate, dismissUpdate, registration, waitingWorker };
}
