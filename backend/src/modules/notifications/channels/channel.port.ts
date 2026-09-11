import { Channel } from '../entities/notification-template.entity';
export interface ChannelPort {
  channel: Channel;
  send(to: string, subject: string | null, body: string, meta: { locale: string; idempotencyKey: string; templateName?: string | null }): Promise<{ providerRef: string }>;
  isTransientError(err: any): boolean;
}

// Helpers to detect transient vs permanent
export function isTransient(err: any): boolean {
  const code = err?.status || err?.code;
  return code === 429 || (code >= 500 && code < 600) || err?.code === 'ETIMEDOUT';
}
