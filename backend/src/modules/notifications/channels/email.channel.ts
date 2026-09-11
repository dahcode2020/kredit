import { Injectable } from '@nestjs/common';
import { ChannelPort } from './channel.port';

@Injectable()
export class EmailChannel implements ChannelPort {
  channel = 'EMAIL' as const;
  async send(to: string, subject: string | null, body: string, meta: { locale: string; idempotencyKey: string }) {
    // AWS SES via SDK v3 — secrets jamais exposés
    const from = process.env.EMAIL_FROM ?? 'no-reply@kredit.be';
    // In prod: const ses = new SESClient({ region: process.env.AWS_REGION });
    // await ses.send(new SendEmailCommand({ Source: from, Destination:{ToAddresses:[to]}, Message:{ Subject:{Data:subject??''}, Body:{ Html:{Data: body }}}));
    // Stub for demo/test — log et retourne fake MessageId
    const providerRef = `ses-${meta.idempotencyKey.slice(0,8)}`;
    console.log(`[EMAIL] to=${to} subject=${subject} locale=${meta.locale} ref=${providerRef}`);
    return { providerRef };
  }
  isTransientError(err: any) { return err?.status >= 500 || err?.code === 'Throttling'; }
}
