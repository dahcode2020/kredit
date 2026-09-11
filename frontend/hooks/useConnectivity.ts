"use client";
import { useEffect, useState, useCallback } from "react";

export type ConnectivityState = "ONLINE" | "OFFLINE" | "SYNCING";

export function useConnectivity(): { state: ConnectivityState; isOnline: boolean; isOffline: boolean; isSyncing: boolean; setSyncing: (v: boolean) => void } {
  const [state, setState] = useState<ConnectivityState>("ONLINE");

  useEffect(() => {
    // Correct initial value on client mount (SSR defaults to ONLINE)
    if (typeof navigator !== 'undefined' && !navigator.onLine) setState("OFFLINE");
  }, []);

  const updateOnline = useCallback(() => {
    if (!navigator.onLine) setState("OFFLINE");
    else {
      // Briefly show SYNCING when coming back online
      setState("SYNCING");
      setTimeout(() => setState("ONLINE"), 1200);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => updateOnline();
    const onOffline = () => setState("OFFLINE");

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Listen to SW sync messages
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "SYNCING") setState("SYNCING");
      if (e.data?.type === "SYNCED") setState("ONLINE");
    };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", onMessage as any);
    }

    // Periodic sync check via SW
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      // No-op, sync is event-driven
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if (navigator.serviceWorker) navigator.serviceWorker.removeEventListener("message", onMessage as any);
    };
  }, [updateOnline]);

  return {
    state,
    isOnline: state === "ONLINE",
    isOffline: state === "OFFLINE",
    isSyncing: state === "SYNCING",
    setSyncing: (v: boolean) => setState(v ? "SYNCING" : navigator.onLine ? "ONLINE" : "OFFLINE"),
  };
}
