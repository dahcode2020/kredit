// KREDIT Push Notifications helper
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) throw new Error('Notifications non supportées');
  const perm = await Notification.requestPermission();
  return perm;
}

export async function subscribePush(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VAPID_PUBLIC_KEY manquante — notifications push désactivées');
    return null;
  }
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return null;
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  // Sync with backend (best effort)
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/notifications/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
      credentials: 'include',
    });
  } catch (_) {}
  return sub;
}

export async function unsubscribePush(registration: ServiceWorkerRegistration) {
  const sub = await registration.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/notifications/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
        credentials: 'include',
      });
    } catch (_) {}
  }
}
