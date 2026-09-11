import { Injectable } from '@nestjs/common';
import { ChannelPort } from './channel.port';
@Injectable()
export class SmsChannel implements ChannelPort {
  channel = 'SMS' as const;
  async send(to: string, _subject: string | null, body: string, meta: { locale: string; idempotencyKey: string }) {
    // Twilio: client.messages.create({ to, from: process.env.TWILIO_FROM, body })
    const sid = `SM${meta.idempotencyKey.slice(0,8)}`;
    console.log(`[SMS] to=${to} body=${body.slice(0,40)} ref=${sid}`);
    return { providerRef: sid };
  }
  isTransientError(err: any) { return err?.status === 429 || err?.status >= 500; }
}
