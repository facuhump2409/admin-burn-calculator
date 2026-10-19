# Project Context & Agent Rules
> Read this file before making changes. Document any deployment findings here.

## Overview
Standalone admin dashboard (BurnMetrics Admin) for the pediatric burn calculator, migrated out of the `burn-calculator` repo (Oct 2026). Production URL: `https://admin.regladecuadrantes.com/`. See `README.md` for commands, API, and deployment.

## Design Principles
- **Mobile first:** design for mobile viewports first, then adapt with Tailwind `sm:`/`md:`/`lg:` prefixes.

## Tech Stack
TypeScript, React 18, Vite 7 (Node >= 20.19), Tailwind CSS v4 (`@tailwindcss/postcss`), Lucide React, Vercel Analytics, Vercel serverless functions (`api/`), Upstash Redis, Neon/Postgres (`@neondatabase/serverless`), Vitest, Playwright.

## Git Commits
- Always commit with `--no-verify`.
- Vercel blocks deployments whose commit author email is not verified on GitHub; use your GitHub email or `{username}@users.noreply.github.com`.

## Architecture
- The SPA calls its API on the **same origin** (`/api/*`) by default; `VITE_API_URL` overrides it only for special setups. Cookies are first-party (`burncalc_admin_session`, `SameSite=Lax`, httpOnly).
- `api/lib/session.ts` stores admin sessions as `admin_sess:<id>` in Redis. Login lockout keys: `admin_lockout:<ip>`, `admin_failed:<ip>`. A `403 locked_out` rejects every password until expiry; to unblock early, an authorized operator removes only the affected IP's two keys.
- The dashboard checks the admin session on focus/visibility/pageshow and every minute while visible; a `401` clears data and returns to the admin login. Request generations prevent late responses from re-opening an expired session.
- `/api/dashboard` reads `burn_simulations` (written by the calculator's `/api/simulations` in the `burn-calculator` repo). It also runs idempotent `CREATE TABLE/ADD COLUMN IF NOT EXISTS`; keep its schema in sync when the calculator adds columns. Rows are cached per UTC day in memory; `?refresh=true` (the **Actualizar** button) bypasses the cache.
- `api/lib/confirmationMetrics.ts` computes hospital-confirmation deviation metrics (signed delta = confirmed − estimated %SCQ; mean absolute deviation; grouped per hospital, missing → `Hospital sin dato`).
- Photos are never persisted; the dashboard only shows calculation data.

## Deployment
- `.github/workflows/vercel.yml` deploys to Vercel Production on pushes to `master` with secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- Vercel env vars: `ADMIN_PASSWORD_HASH`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DATABASE_URL`/`POSTGRES_URL`, optional `ALLOWED_ORIGINS`.
- Domain: `admin.regladecuadrantes.com` → Cloudflare CNAME `admin` → `cname.vercel-dns.com`, DNS only.
- An HTTP 200 for the HTML/JS does not prove login works; verify `/api/admin-session-status` and a real login.
