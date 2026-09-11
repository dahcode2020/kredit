import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

// AES-256-GCM + Vault transit en prod
@Injectable()
export class EncryptionService {
  private key = crypto.scryptSync(process.env.ENCRYPTION_KEY ?? 'dev-key-32-chars-minimum-123456', 'salt', 32);
  encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  }
  decrypt(payload: string): string {
    const [ivHex, tagHex, encHex] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivHex,'hex'));
    decipher.setAuthTag(Buffer.from(tagHex,'hex'));
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex,'hex')), decipher.final()]);
    return dec.toString('utf8');
  }
  hashNiss(niss: string): { hash: string; last4: string } {
    const pepper = process.env.NISS_PEPPER ?? 'pepper-dev';
    const hash = crypto.createHash('sha256').update(niss + pepper).digest('hex');
    return { hash, last4: niss.slice(-4) };
  }
}
