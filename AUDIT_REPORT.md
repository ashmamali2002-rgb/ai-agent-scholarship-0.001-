# GETSCO v2.0 — Phase 1 System Audit Report

**Date:** 16 June 2026
**Scope:** Full static audit of the codebase (frontend, API routes, AI/search/email libraries, database schema). No code modified.
**Stack:** TypeScript · Hono · Cloudflare Pages/Workers · Cloudflare D1 (SQLite) · Groq Llama 3.3 70B · Serper (search) · Jina (page reader) · Resend (email).

Severity legend: 🔴 Critical (breaks a feature) · 🟠 Major (degrades a feature) · 🟡 Minor (polish / risk).

---

## A. Setup / "Why nothing works yet" blockers

| # | Sev | Finding | Detail |
|---|-----|---------|--------|
| A1 | 🔴 | **No `.dev.vars` file** | Only `.dev.vars.example` exists. Without real keys for `GROQ_API_KEY`, `SERPER_API_KEY`, `JINA_API_KEY`, `RESEND_API_KEY`, every AI call, search, page-read and email **fails silently**. This is the #1 reason the app appears "broken." |
| A2 | 🟠 | **Production D1 id is a placeholder** | `wrangler.jsonc` → `"database_id": "placeholder-will-be-replaced"`. Local dev works (`--local`), but `npm run deploy` to Cloudflare will not bind the database until a real D1 id is set. |
| A3 | 🟡 | **`public/static/style.css` is empty (0 bytes)** | It is served at `/static/*` but contains nothing. All styling is inline (Tailwind CDN + `<style>` block). Harmless but dead. |

## B. Broken buttons / navigation (confirmed by reading the code)

| # | Sev | Finding | Location |
|---|-----|---------|----------|
| B1 | 🔴 | **Two dashboard Quick-Action buttons do nothing** | `src/index.tsx` ~L436–438. "Find Professors" and "Generate Documents" pass the handler as the *string* `"()=>window.location='/professors'"`, rendered into `onclick="()=>..."`. The browser builds an arrow function and throws it away — **no navigation happens**. (The other three buttons use `doSearch()`/`openChat()`/`runAgent()` and work.) |
| B2 | 🔴 | **Scholarship card "Apply" & "Docs" buttons have mangled `onclick`** | `src/index.tsx` ~L589–590. The quote-escaping for the title (`.replace(/'/g, ...)`) is malformed and prematurely closes the `onclick="..."` attribute, producing invalid HTML. Apply / Generate-Docs from the Scholarships list are unreliable, and any title containing an apostrophe breaks the row. |
| B3 | 🟡 | **"Send" application uses `prompt()`** | `src/index.tsx` ~L825. Works, but a raw browser prompt for the committee email is fragile UX, and (see D2) the email cannot actually be delivered on the current Resend sandbox. |

## C. Scholarship Search Engine

| # | Sev | Finding | Detail |
|---|-----|---------|--------|
| C1 | 🔴 | **Search likely times out on Cloudflare free tier** | `POST /api/scholarships/search` loops 5 queries × up to 3 results, each doing *score + page-read + analyze* AI/HTTP calls. That is ~50 subrequests in one request — at/over the Workers free-tier subrequest limit — plus 30–60s of latency. High chance of timeout / partial failure. Needs batching, limits, and `Promise.all` parallelism. |
| C2 | 🟠 | **`success_probability` & `recommendation_reason` are never written for new scholarships** | Columns were added in migration `0004` and back-filled once for existing rows, but the `INSERT`s in `scholarships.ts` (`/search`, `/scan-known`) don't set them. New finds always have `success_probability = 0` and no reason. |
| C3 | 🟠 | **Those fields are also never shown in the UI** | Scholarship cards display `match_score` only. The Phase-2 goals "Success Probability" and "Recommendation Reasoning" are not surfaced anywhere. |
| C4 | 🟡 | **Expiry logic is hard-coded to fixed dates** | `cleanup-expired` marks anything containing "2025" or "Jan–May 2026" as expired. It won't age forward on its own and can mis-flag annual programs. |
| C5 | 🟡 | **`field` column never populated** | Inserts omit `field`, so document generation always falls back to "Biotechnology" instead of the scholarship's actual field. |

## D. Email / Applications

| # | Sev | Finding | Detail |
|---|-----|---------|--------|
| D1 | 🟠 | **Resend sandbox can only email *you*** | `FROM_EMAIL = onboarding@resend.dev`. On the Resend sandbox, mail can only be delivered to your own verified address. So "Send application to the committee" (`sendApplicationEmail`) will **not reach real committees** until a domain is verified in Resend. Test-email to yourself works. |
| D2 | 🟡 | **Date string drift** | `email.ts` constant says "June 6, 2026" but the test-email HTML body hard-codes "June 7, 2026". Cosmetic but visible to you in the inbox. |

## E. Professor Recommendation System

| # | Sev | Finding | Detail |
|---|-----|---------|--------|
| E1 | 🔴 | **Faculty pages get blocked before they're read** | `readWebpage()` calls `classifyUrl()` and returns `""` for any domain not in the trusted Tier-1 list or ending in `.edu/.ac.*`. Most real university domains (e.g. **uni-heidelberg.de** — your own placeholder example — and most `.de/.jp/.kr/.cn` sites) fail this check, so the page is never fetched and **0 professors are extracted**. The professor finder works only for a narrow set of `.edu` schools. This is the biggest gap in the feature. |
| E2 | 🟡 | **No compatibility reasoning** | Relevance score is computed, but there's no "why this professor fits you" explanation as the Phase-2 spec wants. |

## F. Document Generation

| # | Sev | Finding | Detail |
|---|-----|---------|--------|
| F1 | 🟠 | **Not truly scholarship/university/department-specific** | Generation passes title/org/country/field, but the prompts are heavily hard-coded to one biography and don't first *analyze the specific scholarship's required documents*. Phase-2 asks for required/missing-docs detection and a readiness score — none of that exists yet. |
| F2 | 🟡 | **No "Required / Missing / Readiness" UI** | The Documents page lists generated docs only. The requested checklist + readiness score is unbuilt. |

## G. Database / Migrations

| # | Sev | Finding | Detail |
|---|-----|---------|--------|
| G1 | 🟠 | **Migration 0004 contains an acknowledged-wrong dedup** | Step 2 deletes by `MAX(id)` per title (keeps newest, not highest score) and a code comment literally says *"Actually above approach is wrong."* It still runs on every fresh migrate. |
| G2 | 🟡 | **Step 8 `source_domain` backfill is a broken nested `replace()`** | The expression is malformed and will produce garbage domains for back-filled rows. |
| G3 | 🟡 | **Seed email ≠ app email** | `0002_seed_profile.sql` seeds `ashmam@scholarshipagent.com`, but the code/UI use `ashmamali2002@gmail.com`. The Data-Preview profile section shows the stale seeded address. |

## H. Reliability / Architecture

| # | Sev | Finding | Detail |
|---|-----|---------|--------|
| H1 | 🟠 | **`/api/agent/run` self-fetches its own origin** | It does `fetch(origin + "/api/scholarships/search")`. Worker-to-self subrequests are fragile on Cloudflare and a likely cause of "Agent error. Check database." Should call the search logic directly instead. |
| H2 | 🟡 | **Secrets bridged through `globalThis`** | Middleware copies `c.env.*` onto `globalThis`. It works per-request but is a Cloudflare anti-pattern (cross-request bleed risk). Better to pass env explicitly. |
| H3 | 🟡 | **Silent failures everywhere** | Most `catch` blocks just `console.error` and return empty/`50`. No user-visible error states, no retries, no loading skeletons — Phase-3 items. |

---

## Summary scoreboard

- 🔴 Critical: **6** — A1, B1, B2, C1, E1, (deploy: A2)
- 🟠 Major: **8** — C2, C3, D1, F1, G1, H1, E-ish, etc.
- 🟡 Minor/polish: ~10

**Good news:** the architecture is sound and worth keeping. The UI is genuinely well-built, the routing/DB layering is clean, and most "broken" symptoms trace back to a handful of root causes: **(1) missing API keys, (2) a few mis-written `onclick` handlers, (3) the over-aggressive URL trust filter strangling the professor + page-reading features, and (4) search doing too much work in one request.** None of this requires a rebuild — it matches your "fix and enhance, don't replace" rule.

## Recommended fix order (Phase 2 entry point)
1. **A1** — create `.dev.vars` so the app actually runs (you provide keys).
2. **B1 + B2** — fix the dead/mangled buttons (pure frontend, fast, high-visibility).
3. **E1** — loosen `readWebpage`/`classifyUrl` so professor discovery works for real universities.
4. **C1** — make search parallel + bounded so it stops timing out.
5. **C2/C3** — write & display `success_probability` + `recommendation_reason`.
6. Then F (documents), G (migration cleanup), H (reliability).
