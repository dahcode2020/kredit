import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
@Injectable()
export class AuditService {
  // Append-only hash chain — in prod: INSERT only, no UPDATE/DELETE, prev_hash FK
  async log(entry: { actorId: string; action: string; entity: string; entityId: string; before?: any; after?: any; reason?: string; prevHash?: string }) {
    const payload = JSON.stringify({ ...entry, ts: new Date().toISOString() });
    const hash = crypto.createHash('sha256').update((entry.prevHash ?? '') + payload).digest('hex');
    // insert into audit_logs (hash, prev_hash)
    return { ...entry, hash, prevHash: entry.prevHash ?? null };
  }
}
