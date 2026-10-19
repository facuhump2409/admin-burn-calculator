# admin-burn-calculator

BurnMetrics admin dashboard for the *Regla de los cuadrantes Cavagna* burn calculator, served at **https://admin.regladecuadrantes.com/**.

It is a standalone Vercel project: a React/Vite SPA plus same-origin serverless functions that read the shared `burn_simulations` Neon/Postgres table. The calculator (`www.regladecuadrantes.com`) and its API (`api.regladecuadrantes.com`) live in the `burn-calculator` repo and contain no admin logic.

## Commands

```bash
npm install
npm run dev        # Vite dev server (API calls go to /api on the same origin)
npm run build      # tsc + vite build → dist/
npm test           # Vitest unit tests
npm run test:e2e   # Playwright (mobile + desktop Chromium) against a production build on 127.0.0.1:4176
```

For E2E, install the browser once with `npx playwright install chromium`. API responses are mocked with synthetic data.

## API (Vercel functions)

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin-login` | bcrypt check against `ADMIN_PASSWORD_HASH`, per-IP rate limit (3/min) and 1-hour lockout after 3 failures, sets httpOnly `burncalc_admin_session` cookie (12 h) |
| `GET /api/admin-session-status` | `204` when the admin session is valid, `401` otherwise |
| `POST /api/admin-logout` | Deletes the Redis session and expires the cookie |
| `GET /api/dashboard` | Dashboard analytics; `?refresh=true` bypasses the per-day in-memory cache |

## Deployment

`.github/workflows/vercel.yml` (**Deploy Admin Dashboard to Vercel**) runs `vercel deploy --prod` on every push to `master`.

1. Create a new Vercel project for this repo (framework: *Other*; `vercel.json` sets build/output).
2. GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (the **new** project's IDs, from `.vercel/project.json` after `npx vercel link`).
3. Vercel environment variables (copy the values from the existing `burn-calculator` Vercel project so both share the same data):

   | Variable | Purpose |
   |----------|---------|
   | `ADMIN_PASSWORD_HASH` | bcrypt hash of the admin password (`node scripts/setup-admin-auth.mjs`) |
   | `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Redis for admin sessions, rate limits and lockouts |
   | `DATABASE_URL` or `POSTGRES_URL` | Neon/Postgres with `burn_simulations` (connect the `burn-calculator-db` Neon resource) |
   | `ALLOWED_ORIGINS` | Optional; defaults to `https://admin.regladecuadrantes.com` |

4. Vercel → Project → Domains: add `admin.regladecuadrantes.com`.
5. Cloudflare DNS: CNAME `admin` → `cname.vercel-dns.com`, **DNS only** (grey cloud) so Vercel can issue the certificate.
