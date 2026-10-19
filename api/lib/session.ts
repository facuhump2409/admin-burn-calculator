import crypto from 'crypto';
import { Redis } from '@upstash/redis';

export const ADMIN_SESSION_COOKIE_NAME = 'burncalc_admin_session';
export const ADMIN_SESSION_PREFIX = 'admin_sess';

export function createRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

export async function createPrefixedSession(
  redis: Redis,
  keyPrefix: string,
  ttlSeconds: number,
): Promise<string> {
  const id = crypto.randomBytes(32).toString('hex');
  await redis.set(`${keyPrefix}:${id}`, String(Date.now()), { ex: ttlSeconds });
  return id;
}

export async function validatePrefixedSession(
  redis: Redis,
  keyPrefix: string,
  sessionId: string | undefined,
): Promise<boolean> {
  if (!sessionId) return false;
  const v = await redis.get(`${keyPrefix}:${sessionId}`);
  return v != null;
}

export async function deletePrefixedSession(
  redis: Redis,
  keyPrefix: string,
  sessionId: string | undefined,
): Promise<void> {
  if (!sessionId) return;
  await redis.del(`${keyPrefix}:${sessionId}`);
}

export function buildNamedSessionSetCookie(
  cookieName: string,
  sessionId: string,
  maxAgeSec: number,
  secure: boolean,
): string {
  const parts = [
    `${cookieName}=${sessionId}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function parseNamedCookie(
  cookieHeader: string | undefined,
  cookieName: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const prefix = `${cookieName}=`;
  for (const c of cookies) {
    if (c.startsWith(prefix)) {
      return c.slice(prefix.length);
    }
  }
  return undefined;
}
