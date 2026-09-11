"use client";
import { useEffect, useState, useCallback } from "react";
import { subscribePush, unsubscribePush } from "@/lib/push";

/**
 * Hydration-safe push state.
 *
 * Règle: `Notification.permission` / `'PushManager' in window` ne doivent JAMAIS
 * être lus pendant le premier rendu (render) d'un client component.
 * Le HTML du serveur est rendu sans `window` → permission = "default", alors que
 * le navigateur renvoie déjà "granted"/"denied" : le premier rendu client diffère
 * du HTML → « Hydration failed because the initial UI does not match ».
 * On part donc d'une valeur identique partout ("unsupported") et on corrige après
 * hydratation, dans un effect.
 */
export type PushSupport = "checking" | "supported" | "unsupported";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [support, setSupport] = useState<PushSupport>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupport("unsupported");
      return;
    }
    setSupport("supported");
    setPermission(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      setPermission(Notification.permission);
    } catch {}
  }, []);

  // Lecture des APIs navigateur uniquement après hydratation
  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await subscribePush(reg);
      setSubscribed(!!sub);
      setPermission(Notification.permission);
      return !!sub;
    } finally { setLoading(false); }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      await unsubscribePush(reg);
      setSubscribed(false);
    } finally { setLoading(false); }
  }, []);

  return { permission, support, subscribed, loading, subscribe, unsubscribe, refresh };
}
