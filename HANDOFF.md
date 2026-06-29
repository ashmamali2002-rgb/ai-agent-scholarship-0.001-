# GETSCO — Project Handoff & Architecture

GETSCO is an AI-powered scholarship & admissions assistant, being built into a
multi-user SaaS platform. This document gives any developer or AI the context to
continue the project.

## Stack
- **Frontend + API:** TypeScript + [Hono](https://hono.dev) running on **Cloudflare Pages/Workers** (advanced mode `_worker.js`). UI is server-rendered HTML strings with vanilla JS + Tailwind (CDN) + axios.
- **Shared data (scholarships):** Cloudflare **D1** (SQLite) — server-managed shared pool.
- **Per-user data (auth, profiles, saved, applications, documents):** **Supabase** (Postgres + Auth + Storage) with Row-Level Security.
- **AI:** Groq (Llama 3.3 70B) — provider-swappable. **Search:** Serper (Google). **Page reader:** Jina. **Email:** Resend. **Reference verification:** Crossref (free).

## How to run locally
1. `npm install`
2. Copy `.dev.vars.example` → `.dev.vars` and fill in real keys (Groq, Serper, Jina, Resend, Supabase URL + anon + service_role, REFRESH_SECRET).
3. In Supabase SQL Editor, run `supabase/schema.sql` (creates multi-user tables + RLS + signup trigger). In Supabase Auth, disable "Confirm email" for easy local testing (or configure SMTP).
4. `npm run build` then `npm run db:migrate:local` then `npx wrangler pages dev dist --d1=scholarship-agent-production --local --port 3000`
   - Or just double-click `START-GETSCO.bat`.
5. Open http://localhost:3000 (you'll be redirected to /login).

## Key files
- `src/index.tsx` — main app: env injection, page routes (auth-gated), all HTML pages, shared client JS helpers.
- `src/routes/` — API: `auth.ts` (Supabase auth + session cookies), `scholarships.ts` (search, **shared pool refresh**, verify), `professors.ts` (global field-aware finder + validation layer), `documents.ts` (AI generation + Crossref reference verification), `applications.ts`, `agent.ts` (chat, quality metrics, export), `profile.ts` (per-user Supabase profile).
- `src/lib/` — `ai.ts` (LLM prompts + extraction), `search.ts` (Serper/Jina + trust filtering), `verify.ts` (Crossref references, domain/country/link validation), `departments.ts` (field→department mapping), `scoring.ts`, `email.ts`, `supabase.ts` (REST client), `http.ts` (fetch w/ retry).
- `migrations/` — D1 schema (0001–0007). `supabase/schema.sql` — Supabase multi-user schema.
- `.github/workflows/refresh-pool.yml` — cron that refreshes the shared pool 4×/day (needs the app deployed + repo secrets GETSCO_URL, REFRESH_SECRET).

## Architecture notes
- **Shared scholarship pool:** `refreshPool()` in `scholarships.ts` pulls new scholarships, deletes expired, dedupes. Triggered by `POST /api/scholarships/refresh-pool` (protected by `REFRESH_SECRET`). All users read this shared pool — keeps cost flat as users grow.
- **Multi-user:** Supabase Auth issues JWTs; the backend uses each user's JWT against Supabase REST so RLS isolates data. Page routes redirect to `/login` without a session cookie.
- **Anti-fabrication:** professor emails/links are only stored if they literally appear on the source page; references are verified against Crossref or marked "Reference could not be verified."

## Current state / roadmap
- DONE: audit + fixes, search rebuild, professor intelligence, quality/verification layer, Supabase auth (M1), editable per-user profile + auth gate (M2), shared pool + 4×/day refresh.
- NEXT: per-user matching (score shared pool against each user's profile), migrate scholarships/professors/documents fully per-user, Supabase Storage file uploads, subscriptions/Stripe scaffold, deploy to Cloudflare Pages, broaden search coverage beyond biotech.

## Security
- Secrets live ONLY in `.dev.vars` (gitignored) — never commit them. `.dev.vars.example` shows the shape with placeholders.
