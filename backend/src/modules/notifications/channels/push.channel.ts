import { Injectable } from '@nestjs/common';
import { ChannelPort } from './channel.port';
@Injectable()
export class PushChannel implements ChannelPort {
  channel = 'PUSH' as const;
  async send(to: string, subject: string | null, body: string, meta: { locale: string; idempotencyKey: string }) {
    // to = push endpoint JSON stringified subscription
    // web-push: webpush.setVapidDetails('mailto:no-reply@kredit.be', VAPID_PUBLIC, VAPID_PRIVATE)
    // await webpush.sendNotification(subscription, JSON.stringify({ title: subject, body, locale: meta.locale }))
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    if (!vapidPublic) {
      console.log(`[PUSH] mock endpoint=${to.slice(0,30)} title=${subject}`);
      return { providerRef: `push-${meta.idempotencyKey.slice(0,8)}` };
    }
    // dynamic import to avoid hard dep
    const webpush = await import('web-push').catch(()=> null);
    if (!webpush) throw new Error('web-push not installed');
    const sub = JSON.parse(to);
    await (webpush as any).sendNotification(sub, JSON.stringify({ title: subject, body }));
    return { providerRef: `push-${Date.now()}` };
  }
  isTransientError(err: any) { return err?.statusCode === 429 || err?.statusCode >= 500; }
}
