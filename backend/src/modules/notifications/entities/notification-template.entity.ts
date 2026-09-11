export type Locale = 'fr' | 'en' | 'nl' | 'de';
export type Channel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
export type NotifEvent =
  | 'ACCOUNT_CREATED' | 'OTP_REQUESTED' | 'APPLICATION_STARTED' | 'APPLICATION_SUBMITTED'
  | 'DOCUMENT_REQUIRED' | 'APPLICATION_UNDER_REVIEW' | 'APPLICATION_APPROVED'
  | 'APPLICATION_APPROVED_EXCEPTION' | 'APPLICATION_REJECTED' | 'CONTRACT_READY'
  | 'PAYMENT_RECEIVED' | 'PAYMENT_DUE' | 'PAYMENT_OVERDUE';

export class NotificationTemplate {
  id!: string;
  event!: NotifEvent;
  channel!: Channel;
  locale!: Locale;
  subject?: string | null;
  body!: string;
  whatsapp_hsm_id?: string | null;
  whatsapp_template_name?: string | null;
  is_active!: boolean;
  version!: number;
  created_at!: Date;
}

export const DEFAULT_CHANNELS: Record<NotifEvent, Channel[]> = {
  ACCOUNT_CREATED: ['EMAIL', 'PUSH'],
  OTP_REQUESTED: ['SMS', 'WHATSAPP'],
  APPLICATION_STARTED: ['PUSH'],
  APPLICATION_SUBMITTED: ['EMAIL', 'WHATSAPP', 'PUSH'],
  DOCUMENT_REQUIRED: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'],
  APPLICATION_UNDER_REVIEW: ['EMAIL', 'PUSH'],
  APPLICATION_APPROVED: ['EMAIL', 'WHATSAPP', 'PUSH'],
  APPLICATION_APPROVED_EXCEPTION: ['EMAIL', 'WHATSAPP', 'PUSH'],
  APPLICATION_REJECTED: ['EMAIL', 'PUSH'],
  CONTRACT_READY: ['EMAIL', 'WHATSAPP', 'PUSH'],
  PAYMENT_RECEIVED: ['EMAIL', 'PUSH'],
  PAYMENT_DUE: ['EMAIL', 'SMS', 'PUSH'],
  PAYMENT_OVERDUE: ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'],
};
