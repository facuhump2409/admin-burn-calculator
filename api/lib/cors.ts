import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Used when `ALLOWED_ORIGINS` is missing or blank on Vercel (common misconfiguration).
 * Override with `ALLOWED_ORIGINS` for other deployments.
 */
const DEFAULT_ALLOWED_ORIGINS = 'https://admin.regladecuadrantes.com';

export function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  const merged =
    raw && raw.length > 0 ? raw : DEFAULT_ALLOWED_ORIGINS;
  return merged
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Reflect allowed Origin + credentials for browser requests to the admin API.
 * @returns whether the request Origin is allowed (caller may skip body on disallowed OPTIONS).
 */
export function applyCorsCredentials(
  req: VercelRequest,
  res: VercelResponse,
): boolean {
  const origin = (req.headers.origin || '').trim().replace(/\/+$/, '');
  const allowed = getAllowedOrigins();
  if (!origin || !allowed.includes(origin)) {
    return false;
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  return true;
}

export function handleCorsPreflight(
  req: VercelRequest,
  res: VercelResponse,
): boolean {
  const corsOk = applyCorsCredentials(req, res);

  if (corsOk) {
    const reqHeaders = req.headers['access-control-request-headers'];
    res.setHeader(
      'Access-Control-Allow-Headers',
      typeof reqHeaders === 'string' && reqHeaders.length > 0
        ? reqHeaders
        : 'Content-Type',
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, HEAD, POST, OPTIONS',
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(corsOk ? 204 : 403).end();
    return true;
  }
  return false;
}
