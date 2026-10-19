import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCorsCredentials, handleCorsPreflight } from './lib/cors.js';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_PREFIX,
  createRedis,
  parseNamedCookie,
  validatePrefixedSession,
} from './lib/session.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (handleCorsPreflight(req, res)) return;
  applyCorsCredentials(req, res);
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const redis = createRedis();
  const sid = parseNamedCookie(req.headers.cookie, ADMIN_SESSION_COOKIE_NAME);
  const ok = await validatePrefixedSession(redis, ADMIN_SESSION_PREFIX, sid);

  if (!ok) {
    res.status(401).json({ ok: false });
    return;
  }

  res.status(204).end();
}
