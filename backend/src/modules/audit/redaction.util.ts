/**
 * Redaction util — ne jamais journaliser de données sensibles en clair
 * Liste basée sur RGPD + PCI-DSS minimal
 */
const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'passwordHash', 'currentPassword', 'newPassword', 'confirmPassword',
  'secret', 'mfa_secret', 'mfaSecret', 'totp', 'otp', 'code',
  'token', 'accessToken', 'refreshToken', 'jwt', 'authorization',
  'niss', 'niss_hash', 'ssn', 'nationalNumber',
  'iban', 'accountNumber', 'cardNumber', 'pan', 'cvv', 'expiry',
  'privateKey', 'publicKey',
]);

const SENSITIVE_PATTERNS = [
  /iban/i, /pan$/i, /card.*number/i, /niss/i, /ssn/i, /secret/i, /token/i, /password/i, /authorization/i,
];

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEYS.has(key)) return true;
  return SENSITIVE_PATTERNS.some(re => re.test(key));
}

export function redact(value: any, depth = 0, seen = new WeakSet()): any {
  if (depth > 6) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    // Heuristique: si valeur ressemble à JWT ou hash long, tronquer
    if (value.length > 80 && /^[A-Za-z0-9\-_\.]+$/.test(value)) return '[REDACTED_JWT]';
    return value;
  }
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(v => redact(v, depth + 1, seen));
  }
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (isSensitiveKey(k)) {
      // Pour traçabilité, on garde un hash partiel si valeur est string courte, sinon juste flag
      if (typeof v === 'string' && v.length >= 4 && v.length <= 32) {
        out[k] = '[REDACTED:sha256:' + simpleHash(v).slice(0, 12) + ']';
      } else {
        out[k] = '[REDACTED]';
      }
    } else if (typeof v === 'object' && v !== null) {
      out[k] = redact(v, depth + 1, seen);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function simpleHash(s: string): string {
  // FNV-like simple hash pour redaction preview (pas cryptographique, juste pour distinguer)
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h).toString(16).padStart(8, '0');
}

export function diffBeforeAfter(before: any, after: any): { before: any; after: any } {
  const b = redact(before);
  const a = redact(after);
  // Optionnel: ne garder que les champs modifiés
  if (!b || !a) return { before: b, after: a };
  const keys = new Set([...Object.keys(b || {}), ...Object.keys(a || {})]);
  const beforeDiff: any = {};
  const afterDiff: any = {};
  let hasDiff = false;
  for (const k of keys) {
    const bv = (b as any)[k];
    const av = (a as any)[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      beforeDiff[k] = bv;
      afterDiff[k] = av;
      hasDiff = true;
    }
  }
  return hasDiff ? { before: beforeDiff, after: afterDiff } : { before: {}, after: {} };
}

export function sanitizeReason(reason?: string): string | undefined {
  if (!reason) return reason;
  // Raison métier peut contenir du texte libre — on enlève les patterns sensibles si présents
  return reason.replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
    .replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]');
}
