import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../modules/audit/audit.service';

export type AlertChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WEBHOOK' | 'SIEM';
export interface AlertPayload {
  title: string;
  body: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  correlation_id?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  // In-memory outbox for dev
  private outbox: any[] = [];

  constructor(private readonly audit: AuditService) {}

  async send(channel: AlertChannel, recipient: string, template: string, payload: AlertPayload): Promise<void> {
    const entry = {
      id: this.outbox.length + 1,
      channel, recipient, template, payload, status: 'PENDING', correlation_id: payload.correlation_id ?? null, created_at: new Date(),
    };
    this.outbox.push(entry);
    this.logger.log(`ALERT ${payload.severity} -> ${channel}:${recipient} [${template}] corr=${payload.correlation_id} title=${payload.title}`);

    // Prod: INSERT INTO alerts ... + dispatch via queue (BullMQ) -> Email (SES), SMS (Twilio), Push, Webhook SIEM
    // Ici on simule envoi immédiat
    entry.status = 'SENT';
    await this.audit.logSecurity({
      event_type: 'RATE_LIMITED' as any, // generic, on utilise security log pour l'alerte elle-même ?
      metadata: { alert: true, channel, template, payload: { title: payload.title, severity: payload.severity } },
      correlation_id: payload.correlation_id ?? null,
      severity: payload.severity,
    }).catch(()=>{});
  }

  async alertAdmins(payload: AlertPayload): Promise<void> {
    // Récupère liste admins en prod via DB, ici on notifie hard-coded + SIEM
    const admins = (process.env.ALERT_ADMIN_EMAILS ?? 'admin@kredit.be,superadmin@kredit.be').split(',').map(s=>s.trim()).filter(Boolean);
    for (const email of admins) {
      await this.send('EMAIL', email, 'security.critical', payload);
    }
    // SIEM webhook si configuré
    if (process.env.SIEM_WEBHOOK_URL) {
      await this.send('WEBHOOK', process.env.SIEM_WEBHOOK_URL, 'siem.security', payload);
    }
  }

  async onAnomalyAnomaly(payload: AlertPayload & { type: string }): Promise<void> {
    if (payload.severity === 'CRITICAL') await this.alertAdmins(payload);
  }

  async onBruteForce(email: string, ip: string | null, correlation_id?: string): Promise<void> {
    await this.alertAdmins({
      title: `Brute force detecté: ${email}`,
      body: `5 échecs login pour ${email} depuis ${ip ?? 'IP inconnue'} — compte verrouillé 15m. Corrélation ${correlation_id ?? 'n/a'}.`,
      severity: 'CRITICAL',
      correlation_id,
      metadata: { email, ip },
    });
  }

  async onRateLimited(key: string, ip: string | null, correlation_id?: string): Promise<void> {
    // On n'alerte pas chaque rate limit, on sample
    if (Math.random() < 0.1) {
      await this.send('WEBHOOK', process.env.SIEM_WEBHOOK_URL ?? 'siem', 'siem.rate_limited', {
        title: `Rate limited ${key} ip=${ip}`,
        body: `Rate limit hit ${key}`,
        severity: 'WARN',
        correlation_id,
      });
    }
  }
}
