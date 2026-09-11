"use client";
import { useEffect, useState, useCallback } from "react";
import { subscribePush, unsubscribePush } from "@/lib/push";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      setPermission(Notification.permission);
    } catch {}
  }, []);

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

  return { permission, subscribed, loading, subscribe, unsubscribe, refresh };
}
