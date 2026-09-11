import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../modules/audit/audit.service';

type AnomalyType = 'VELOCITY' | 'IMPOSSIBLE_TRAVEL' | 'DEVICE_CHANGE' | 'BRUTE_FORCE' | 'DUPLICATE_DOC' | 'NISS_DUPLICATE' | 'RATE_LIMIT';

@Injectable()
export class AnomalyDetectorService {
  private readonly logger = new Logger(AnomalyDetectorService.name);
  // In-memory sliding windows for dev
  private events = new Map<string, number[]>(); // key -> timestamps

  constructor(private readonly audit: AuditService) {}

  private push(key: string, now = Date.now()): number[] {
    const arr = this.events.get(key) ?? [];
    arr.push(now);
    // keep 24h
    const cutoff = now - 24 * 60 * 60 * 1000;
    const filtered = arr.filter(t => t > cutoff);
    this.events.set(key, filtered);
    return filtered;
  }

  async checkVelocity(customerId: string, ip?: string | null, correlation_id?: string): Promise<void> {
    const key = `velocity:applications:${customerId}`;
    const arr = this.push(key);
    const lastHour = arr.filter(t => Date.now() - t < 60 * 60 * 1000).length;
    const last24h = arr.length;
    if (lastHour > 3 || last24h > 5) {
      await this.raise('VELOCITY', customerId, { ip, countHour: lastHour, count24h: last24h }, correlation_id, lastHour > 5 ? 'HIGH' : 'MEDIUM');
    }
  }

  async checkImpossibleTravel(customerId: string, ip?: string | null, geo?: { country?: string; lat?: number; lon?: number }, correlation_id?: string): Promise<void> {
    if (!geo?.lat || !geo?.lon) return;
    const key = `travel:last:${customerId}`;
    const prev = (this.events as any)._travel?.[customerId] as { lat: number; lon: number; at: number } | undefined;
    if (!prev) {
      (this.events as any)._travel = (this.events as any)._travel || {};
      (this.events as any)._travel[customerId] = { ...geo, at: Date.now() };
      return;
    }
    const distKm = haversine(prev.lat, prev.lon, geo.lat!, geo.lon!);
    const hours = (Date.now() - prev.at) / 3600000;
    const speed = distKm / Math.max(hours, 0.1); // km/h
    if (speed > 900) { // avion impossible
      await this.raise('IMPOSSIBLE_TRAVEL', customerId, { ip, distKm: Math.round(distKm), hours: hours.toFixed(2), speed: Math.round(speed) }, correlation_id, 'CRITICAL');
    }
    (this.events as any)._travel[customerId] = { ...geo, at: Date.now() };
  }

  async checkDeviceChange(customerId: string, userAgent?: string | null, ip?: string | null, correlation_id?: string): Promise<void> {
    if (!userAgent) return;
    const key = `device:last:${customerId}`;
    const prev = (this.events as any)._device?.[customerId] as string | undefined;
    if (prev && prev !== userAgent) {
      await this.raise('DEVICE_CHANGE', customerId, { ip, prevUA: prev.slice(0, 60), newUA: userAgent.slice(0, 60) }, correlation_id, 'MEDIUM');
    }
    (this.events as any)._device = (this.events as any)._device || {};
    (this.events as any)._device[customerId] = userAgent;
  }

  async checkDuplicateDoc(hash: string, customerId: string, correlation_id?: string): Promise<void> {
    const key = `doc:hash:${hash}`;
    const existing = this.events.get(key);
    if (existing && existing.length > 0) {
      await this.raise('DUPLICATE_DOC', customerId, { hash: hash.slice(0, 12) }, correlation_id, 'HIGH');
    }
    this.push(key);
  }

  private async raise(type: AnomalyType, customerId: string, details: any, correlation_id?: string, risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM') {
    this.logger.warn(`ANOMALY ${type} customer=${customerId} risk=${risk} details=${JSON.stringify(details)}`);
    await this.audit.logSecurity({
      event_type: (`ANOMALY_${type}` as any),
      actor_id: customerId,
      actor_type: 'CUSTOMER',
      actor: customerId,
      entity_type: 'USER',
      entity_id: customerId,
      metadata: { type, risk_level: risk, ...details },
      correlation_id: correlation_id ?? null,
      severity: risk === 'CRITICAL' || risk === 'HIGH' ? 'CRITICAL' : 'WARN',
    });
    await this.audit.log({
      actor: 'SYSTEM', actor_id: null, actor_type: 'SYSTEM', action: 'security.anomaly_detected',
      entity_type: 'USER', entity_id: customerId, reason: `Anomaly ${type} risk=${risk}`, ip: details.ip ?? null, user_agent: details.userAgent ?? details.newUA ?? null, correlation_id: correlation_id ?? 'system',
      before: null, after: { type, risk_level: risk, details },
    });
    // Alertes: si CRITICAL -> notifier ADMIN via AlertService (appel différé pour éviter cycle)
    if (risk === 'CRITICAL' || risk === 'HIGH') {
      // Lazy import to avoid circular
      try {
        const { AlertService } = await import('./alert.service');
        // Si AlertService disponible via DI on l'utilisera autrement; ici on log
        this.logger.error(`ALERT CRITICAL ${type} -> admin notification required corr=${correlation_id}`);
      } catch {}
    }
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
