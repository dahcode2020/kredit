import { Channel, Locale, NotifEvent } from './notification-template.entity';
export type OutboxStatus = 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'BOUNCED';
export class NotificationOutbox {
  id!: string;
  idempotency_key!: string;
  event!: NotifEvent;
  channel!: Channel;
  locale!: Locale;
  recipient!: string;
  template_id!: string;
  payload!: Record<string, any>;
  status!: OutboxStatus;
  attempts!: number;
  last_error?: string | null;
  sent_at?: Date | null;
  delivered_at?: Date | null;
  read_at?: Date | null;
  provider_ref?: string | null;
  created_at!: Date;
}
