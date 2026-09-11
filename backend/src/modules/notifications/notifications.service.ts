import { Injectable, Logger } from '@nestjs/common';
import { I18nService, Locale } from '../../i18n/i18n.service';
import { DEFAULT_CHANNELS, NotificationTemplate } from './entities/notification-template.entity';
import { isChannelEnabled } from './entities/notification-preference.entity';
import { EmailChannel } from './channels/email.channel';
import { SmsChannel } from './channels/sms.channel';
import { WhatsappChannel } from './channels/whatsapp.channel';
import { PushChannel } from './channels/push.channel';
import { ChannelPort } from './channels/channel.port';

// Minimal repository interfaces (TypeORM en prod)
interface TemplateRepo { findActive(event: string, channel: string, locale: Locale): Promise<NotificationTemplate | null> }
interface PrefRepo { findByCustomer(customerId: string): Promise<any> }
interface CustomerRepo { findById(id: string): Promise<{ id:string; email:string; phone:string; locale:Locale } | null> }
interface OutboxRepo {
  insert(data: any): Promise<any>;
  findById(id: string): Promise<any>;
  update(id: string, patch: any): Promise<void>;
  findByIdempotency(key: string): Promise<any | null>;
}
interface QueuePort { add(queue: string, data: any, opts?: any): Promise<void> }

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    private readonly i18n: I18nService,
    private readonly email: EmailChannel,
    private readonly sms: SmsChannel,
    private readonly whatsapp: WhatsappChannel,
    private readonly push: PushChannel,
    // repos injected via custom providers (stubs for build)
  ) {}

  private channels: Record<string, ChannelPort> = {} as any;

  onModuleInit() {
    this.channels = { EMAIL: this.email as any, SMS: this.sms as any, WHATSAPP: this.whatsapp as any, PUSH: this.push as any };
  }

  // Dispatcher — appelé par les domain events
  async dispatch(event: string, customerId: string, payload: Record<string, any> = {}, entityId?: string) {
    // In prod inject repositories; here we mock lookup
    const customer = await this.getCustomer(customerId);
    const locale: Locale = (customer?.locale ?? 'fr') as Locale;
    const pref = await this.getPreference(customerId);
    const channels = this.resolveChannels(event as any, pref);
    for (const ch of channels) {
      if (!isChannelEnabled(pref, ch, event)) {
        this.logger.log(`skip ${event} ${ch} for ${customerId} (disabled)`);
        continue;
      }
      const tpl = await this.getTemplate(event, ch, locale);
      if (!tpl) {
        this.logger.warn(`template missing ${event} ${ch} ${locale}`);
        continue;
      }
      const interpolated = this.interpolate(tpl, payload, locale, customer);
      const recipient = this.recipientFor(ch, customer);
      if (!recipient) continue;
      const idem = `${event}:${entityId ?? 'no-entity'}:${ch}:${locale}:${recipient}:${tpl.version}`;
      // idempotence: INSERT ... ON CONFLICT DO NOTHING
      const outboxId = await this.createOutboxIfNotExists({
        idempotency_key: idem,
        event, channel: ch, locale, recipient,
        template_id: tpl.id,
        payload: { ...payload, subject: tpl.subject, body: interpolated.body, interpolatedSubject: interpolated.subject },
        status: 'PENDING',
      });
      if (!outboxId) { this.logger.log(`idempotent skip ${idem}`); continue; }
      await this.enqueue(ch, { outboxId, channel: ch, locale, recipient, subject: interpolated.subject, body: interpolated.body, templateName: tpl.whatsapp_template_name });
    }
  }

  private async enqueue(channel: string, data: any) {
    // BullMQ — in prod: @InjectQueue('notifications.send.email')
    // Stub: direct send for demo (sync), in prod enqueue with jobId=idempotency_key
    const port = this.channels[channel];
    if (!port) return;
    const outbox = await this.findOutbox(data.outboxId);
    if (!outbox || outbox.status === 'SENT') return;
    try {
      await this.updateOutbox(outbox.id, { status: 'SENDING', attempts: outbox.attempts + 1 });
      const res = await port.send(data.recipient, data.subject, data.body, { locale: data.locale, idempotencyKey: outbox.idempotency_key, templateName: data.templateName });
      await this.updateOutbox(outbox.id, { status: 'SENT', provider_ref: res.providerRef, sent_at: new Date() });
    } catch (e: any) {
      const transient = port.isTransientError(e);
      await this.updateOutbox(outbox.id, { status: transient ? 'PENDING' : 'FAILED', last_error: e.message });
      if (transient && outbox.attempts < 5) throw e; // BullMQ will retry with backoff
      // else DLQ
    }
  }

  private interpolate(tpl: NotificationTemplate, payload: Record<string, any>, locale: Locale, customer: any) {
    const vars: Record<string, any> = {
      name: customer?.email?.split('@')[0] ?? 'client',
      id: payload.applicationId ?? payload.id ?? '',
      amount: payload.amount ? this.i18n.formatCurrency(Number(payload.amount), locale) : '',
      monthly: payload.monthly ? this.i18n.formatCurrency(Number(payload.monthly), locale) : '',
      term: payload.term ?? '',
      taeg: payload.taeg ? this.i18n.formatPercent(Number(payload.taeg)/100, locale) : '',
      contractUrl: payload.contractUrl ?? 'https://kredit.be/contract',
      date: payload.date ? this.i18n.formatDate(new Date(payload.date), locale) : '',
      url: payload.url ?? 'https://kredit.be',
      doc: payload.doc ?? '',
      stop: 'STOP 36179',
      ...payload,
    };
    let subject = tpl.subject ? this.i18n.t(locale, tpl.subject, vars) : null;
    let body = tpl.body;
    body = body.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => ((vars as any)[k] !== undefined ? String((vars as any)[k]) : `{{${k}}}`));
    if (subject) subject = subject.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => ((vars as any)[k] !== undefined ? String((vars as any)[k]) : `{{${k}}}`));
    if (tpl.channel === 'WHATSAPP') {
      body = body.replace(/\{\{1\}\}/g, String(vars.name))
                 .replace(/\{\{2\}\}/g, String(vars.id))
                 .replace(/\{\{3\}\}/g, String(vars.amount))
                 .replace(/\{\{4\}\}/g, String(vars.monthly))
                 .replace(/\{\{5\}\}/g, String(vars.contractUrl));
    }
    return { subject, body };
  }

  private resolveChannels(event: string, pref: any): string[] {
    const defaults = (DEFAULT_CHANNELS as any)[event] ?? ['EMAIL'];
    // filter via preferences if present
    return defaults.filter((ch: string) => isChannelEnabled(pref, ch, event));
  }

  private recipientFor(channel: string, customer: any): string | null {
    if (channel === 'EMAIL') return customer?.email ?? null;
    if (channel === 'SMS' || channel === 'WHATSAPP') return customer?.phone ?? null;
    if (channel === 'PUSH') return customer?.pushEndpoint ?? JSON.stringify({ endpoint: 'https://fcm.googleapis.com/mock', keys:{ p256dh:'x', auth:'y'}});
    return null;
  }

  // --- Stubs for build without DB (replace with TypeORM repos) ---
  private async getCustomer(id: string) {
    // TODO: inject CustomerRepo
    return { id, email: 'alex@kredit.be', phone: '+32470123456', locale: 'fr' as Locale, pushEndpoint: null as any };
  }
  private async getPreference(customerId: string) {
    return { customer_id: customerId, locale:'fr' as Locale, email_enabled:true, sms_enabled:true, whatsapp_enabled:true, push_enabled:true, preferences:{}, consent_whatsapp_at: new Date(), consent_sms_at: new Date(), updated_at: new Date() } as any;
  }
  private async getTemplate(event: string, channel: string, locale: Locale): Promise<NotificationTemplate | null> {
    // In prod: select * from notification_templates where event=$1 and channel=$2 and locale=$3 and is_active order by version desc limit 1
    // Stub via i18n fallback
    const bodyMap: Record<string, string> = {
      'APPLICATION_APPROVED:EMAIL:fr': 'Bonjour {{name}}, votre demande {{id}} est approuvée.',
      'APPLICATION_APPROVED:EMAIL:en': 'Hello {{name}}, your application {{id}} is approved.',
    };
    const key = `${event}:${channel}:${locale}`;
    if (bodyMap[key]) return { id: `tpl-${key}`, event: event as any, channel: channel as any, locale, subject: 'KREDIT', body: bodyMap[key], whatsapp_template_name: 'kredit_approved_fr', is_active:true, version:1, created_at: new Date() } as any;
    // fallback DB read (not implemented for build)
    return null;
  }
  private async createOutboxIfNotExists(data: any): Promise<string | null> {
    // INSERT ... ON CONFLICT DO NOTHING RETURNING id
    return `outbox-${Date.now()}`;
  }
  private async findOutbox(id: string) { return { id, status:'PENDING', attempts:0, idempotency_key:`idem-${id}` } as any; }
  private async updateOutbox(id: string, patch: any) { /* update */ }

  // Admin CRUD for templates (SUPER_ADMIN only)
  async listTemplates(filters: { event?: string; channel?: string; locale?: string }) {
    // SELECT * FROM notification_templates WHERE ...
    return [];
  }
  async upsertTemplate(dto: any, actorId: string) {
    // INSERT ... ON CONFLICT (event, channel, locale, version) DO UPDATE
    // WhatsApp templates require Meta approval — set is_active=false until approved
    return { id: 'new-tpl' };
  }
  async previewTemplate(id: string, vars: Record<string,any>, locale: Locale) {
    const tpl = await this.getTemplate('APPLICATION_APPROVED','EMAIL', locale) as any;
    return this.interpolate(tpl, vars, locale, { email:'test@kredit.be' });
  }
}
