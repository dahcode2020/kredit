import { Injectable, Logger } from '@nestjs/common';

/**
 * SIEM forwarder — en prod: Loki/Grafana + Sentry + WAF
 * Ici: structured JSON logs pour investigation
 */
@Injectable()
export class SiemService {
  private readonly logger = new Logger(SiemService.name);

  logStructured(level: 'info' | 'warn' | 'error', event: string, ctx: Record<string, any>) {
    const payload = {
      timestamp: new Date().toISOString(),
      event,
      ...ctx,
      // Jamais de secret en clair — ctx doit déjà être redacted
    };
    const line = JSON.stringify(payload);
    if (level === 'error') this.logger.error(line);
    else if (level === 'warn') this.logger.warn(line);
    else this.logger.log(line);
    // Prod: forward to Loki via Pino transport, Sentry capture if error/critical
  }
}
