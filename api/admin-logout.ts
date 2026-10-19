import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsCredentials, handleCorsPreflight } from './lib/cors.js';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_PREFIX,
  createRedis,
  deletePrefixedSession,
  parseNamedCookie,
} from './lib/session.js';

function expiredCookie(): string {
  return [
    `${ADMIN_SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ].join('; ');
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

  const redis = createRedis();
  const sid = parseNamedCookie(req.headers.cookie, ADMIN_SESSION_COOKIE_NAME);
  await deletePrefixedSession(redis, ADMIN_SESSION_PREFIX, sid);
  res.setHeader('Set-Cookie', expiredCookie());
  res.status(204).end();
}
