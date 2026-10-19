import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Ratelimit } from '@upstash/ratelimit';
import bcrypt from 'bcryptjs';
import { applyCorsCredentials, handleCorsPreflight } from './lib/cors.js';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_PREFIX,
  buildNamedSessionSetCookie,
  createPrefixedSession,
  createRedis,
} from './lib/session.js';

const ADMIN_SESSION_MAX_AGE_SEC = 12 * 3600;
const redis = createRedis();

const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '60 s'),
  analytics: false,
});

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 3600;

function cookieSecure(req: VercelRequest): boolean {
  return req.headers['x-forwarded-proto'] === 'https';
}

function getClientIp(req: VercelRequest): string {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') return realIp.trim();
  if (Array.isArray(realIp)) return realIp[0];
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0];
  return req.socket?.remoteAddress || '127.0.0.1';
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (handleCorsPreflight(req, res)) return;
  applyCorsCredentials(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const ip = getClientIp(req);
  const { success: rlOk } = await rateLimiter.limit(`admin:${ip}`);
  if (!rlOk) {
    res.status(429).json({
      error: 'rate_limited',
      message: 'Demasiadas solicitudes. Intente en un minuto.',
    });
    return;
  }

  const lockoutKey = `admin_lockout:${ip}`;
  const failedKey = `admin_failed:${ip}`;
  const lockoutUntil = await redis.get<number>(lockoutKey);

  if (lockoutUntil && Date.now() < lockoutUntil) {
    res.status(403).json({
      error: 'locked_out',
      message: 'Acceso administrador bloqueado por demasiados intentos.',
      remainingMs: lockoutUntil - Date.now(),
    });
    return;
  }

  const body = req.body as { password?: unknown } | undefined;
  const password = body?.password;
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!passwordHash) {
    res.status(500).json({ error: 'admin_auth_not_configured' });
    return;
  }

  const isValid = await bcrypt.compare(password, passwordHash);
  if (!isValid) {
    const failed = await redis.incr(failedKey);
    await redis.expire(failedKey, LOCKOUT_SECONDS);

    if (failed >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = Date.now() + LOCKOUT_SECONDS * 1000;
      await redis.set(lockoutKey, lockUntil, { ex: LOCKOUT_SECONDS });
      await redis.del(failedKey);
      res.status(403).json({
        error: 'locked_out',
        message: 'Acceso administrador bloqueado. Intente en 1 hora.',
        remainingMs: LOCKOUT_SECONDS * 1000,
        attemptsRemaining: 0,
      });
      return;
    }

    res.status(401).json({
      error: 'invalid_password',
      message: 'Contraseña de administrador incorrecta',
      attemptsRemaining: MAX_FAILED_ATTEMPTS - failed,
    });
    return;
  }

  await redis.del(failedKey);
  const sessionId = await createPrefixedSession(
    redis,
    ADMIN_SESSION_PREFIX,
    ADMIN_SESSION_MAX_AGE_SEC,
  );

  res.setHeader(
    'Set-Cookie',
    buildNamedSessionSetCookie(
      ADMIN_SESSION_COOKIE_NAME,
      sessionId,
      ADMIN_SESSION_MAX_AGE_SEC,
      cookieSecure(req),
    ),
  );

  res.status(200).json({ ok: true });
}
