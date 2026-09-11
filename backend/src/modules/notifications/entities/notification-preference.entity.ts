import { Locale } from './notification-template.entity';
export class NotificationPreference {
  customer_id!: string;
  locale!: Locale;
  email_enabled!: boolean;
  sms_enabled!: boolean;
  whatsapp_enabled!: boolean;
  push_enabled!: boolean;
  preferences!: Record<string, Record<string, boolean>>; // { PAYMENT_DUE: { sms:true } }
  consent_whatsapp_at?: Date | null;
  consent_sms_at?: Date | null;
  updated_at!: Date;
}

export function isChannelEnabled(pref: NotificationPreference, channel: string, event: string): boolean {
  // global kill-switch
  const globalMap: Record<string, boolean> = {
    EMAIL: pref.email_enabled,
    SMS: pref.sms_enabled,
    WHATSAPP: pref.whatsapp_enabled && !!pref.consent_whatsapp_at,
    PUSH: pref.push_enabled,
  };
  if (!globalMap[channel]) return false;
  // granular override
  const perEvent = pref.preferences?.[event]?.[channel.toLowerCase()];
  if (perEvent !== undefined) return perEvent;
  return true;
}
