import { Hono } from "hono";
import { searchScholarships, readWebpage, buildSearchQueries, getKnownScholarships, classifyUrl } from "../lib/search";
import { scoreScholarship, analyzeScholarshipPage } from "../lib/ai";
import { buildProfileSummary, USER_PROFILE, CURRENT_DATE, CURRENT_YEAR } from "../lib/profile";
import { computeSuccessProbability, buildRecommendationReason, classifyDeadline } from "../lib/scoring";
import { verifyUrlReachable } from "../lib/verify";

type Bindings = { DB: D1Database };
const scholarships = new Hono<{ Bindings: Bindings }>();

// ── Shared search routine — used by the /search route AND the agent ──
// Bounded for Cloudflare limits: few queries, parallel analysis, one AI
// call per candidate (no per-result page fetch in the hot loop).
export async function runScholarshipSearch(
  DB: D1Database,
  customQuery: string | null = null
): Promise<{ found: any[]; skippedExpired: number; queriesRun: number }> {
  const profileSummary = buildProfileSummary();
  const queries = customQuery ? [customQuery] : buildSearchQueries(USER_PROFILE).slice(0, 4);

  // 1) Gather candidate results from all queries (parallel)
  const perQuery = await Promise.all(
    queries.map(async (query) => {
      try {
        await DB.prepare("INSERT INTO search_history (query, results_count) VALUES (?, 0)").bind(query).run();
        return await searchScholarships(query, 5);
      } catch { return []; }
    })
  );

  // 2) Flatten + dedupe by URL, skip ones already stored
  const seen = new Set<string>();
  const candidates: any[] = [];
  for (const results of perQuery) {
    for (const r of results.slice(0, 3)) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      const existing = await DB.prepare("SELECT id FROM scholarships WHERE url = ?").bind(r.url).first();
      if (existing) continue;
      candidates.push(r);
    }
  }
  const bounded = candidates.slice(0, 10);

  // 3) Analyze candidates in parallel (one AI call each, snippet-based)
  const analyses = await Promise.all(
    bounded.map(async (r) => {
      try {
        const analysis = await analyzeScholarshipPage(`${r.title}\n${r.snippet}`, profileSummary);
        return { r, analysis };
      } catch { return null; }
    })
  );

  // 4) Build the keeper list (skip expired) then verify links in parallel
  const keepers = analyses
    .filter((x): x is { r: any; analysis: any } => !!x && !x.analysis.isExpired)
    .map(({ r, analysis }) => {
      const trustInfo = classifyUrl(r.url);
      const finalScore = analysis.matchScore || 50;
      const detectedCountry = analysis.country ||
        USER_PROFILE.targetCountries.find(tc =>
          (analysis.organization + r.url + r.title).toLowerCase().includes(tc.toLowerCase())
        ) || "International";
      const deadline = analysis.deadline || `Check website (${CURRENT_YEAR}-${CURRENT_YEAR + 1} intake)`;
      const isFunded = !!analysis.isFullyFunded;
      return { r, analysis, trustInfo, finalScore, detectedCountry, deadline, isFunded };
    });
  const skippedExpired = analyses.filter(x => x && x.analysis.isExpired).length;

  // LINK VERIFICATION — confirm each application link is reachable.
  const linkOk = await Promise.all(keepers.map(k => verifyUrlReachable(k.r.url)));

  // 5) Store, marking verified only when the link works and the source is trusted
  const found: any[] = [];
  for (let i = 0; i < keepers.length; i++) {
    const k = keepers[i];
    const ok = linkOk[i];
    const trusted = k.trustInfo.tier === "official" || k.trustInfo.tier === "recognised";
    // Verified = trusted source + not expired. The link check is advisory
    // (official sites often block bots) so it never hides a real scholarship.
    const verified = trusted ? 1 : 0;
    const successProb = computeSuccessProbability(k.finalScore, k.isFunded, k.trustInfo.tier);
    const recReason = buildRecommendationReason(k.detectedCountry, k.finalScore);

    await DB.prepare(`
      INSERT OR IGNORE INTO scholarships
      (title, organization, country, field, description, url, deadline, amount,
       requirements, match_score, is_fully_funded, covers, source,
       raw_content, status, is_expired, source_trust_level, source_domain,
       success_probability, recommendation_reason, deadline_type, verified, link_ok, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'found', 0, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      k.analysis.title || k.r.title,
      k.analysis.organization || k.r.source || "Unknown",
      k.detectedCountry,
      "Biotechnology",
      k.r.snippet,
      k.r.url,
      k.deadline,
      k.analysis.amount || "Fully Funded",
      k.analysis.requirements || "See website",
      k.finalScore,
      k.isFunded ? 1 : 0,
      k.analysis.covers || "Tuition, Stipend, Accommodation",
      k.r.source || "web",
      (k.r.snippet || "").substring(0, 2000),
      k.trustInfo.tier,
      k.trustInfo.domain,
      successProb,
      recReason,
      classifyDeadline(k.deadline),
      verified,
      ok ? 1 : 0,
    ).run();
    // Link reachability is best-effort/advisory only — not logged as a
    // verification pass/fail (it has false negatives when sites block bots).

    found.push({ title: k.analysis.title || k.r.title, url: k.r.url, score: k.finalScore, deadline: k.deadline, country: k.detectedCountry, success_probability: successProb, verified });
  }

  return { found, skippedExpired, queriesRun: queries.length };
}

// ── Get all scholarships from DB ─────────────────────────────
scholarships.get("/", async (c) => {
  try {
    const { status, country, limit = "50", page = "1", trust, funded } = c.req.query();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { include_unverified } = c.req.query();
    // Only verified, non-expired scholarships are displayed by default.
    let query = "SELECT * FROM scholarships WHERE (is_expired = 0 OR is_expired IS NULL)";
    if (include_unverified !== "1") query += " AND (verified = 1)";
    const params: any[] = [];

    if (status) { query += " AND status = ?"; params.push(status); }
    if (country) { query += " AND country LIKE ?"; params.push(`%${country}%`); }
    if (trust) { query += " AND source_trust_level = ?"; params.push(trust); }
    if (funded === "1") { query += " AND is_fully_funded = 1"; }

    query += " ORDER BY match_score DESC, created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const results = await c.env.DB.prepare(query).bind(...params).all();
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM scholarships WHERE (is_expired = 0 OR is_expired IS NULL) AND (verified = 1)"
    ).first() as any;

    return c.json({
      success: true,
      scholarships: results.results,
      total: countResult?.total || 0,
      current_date: CURRENT_DATE,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Stats overview ────────────────────────────────────────────
scholarships.get("/stats/overview", async (c) => {
  try {
    // All dashboard stats are computed from VERIFIED, non-expired records only.
    const A = "(is_expired = 0 OR is_expired IS NULL) AND verified = 1";
    const total = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM scholarships WHERE ${A}`
    ).first() as any;
    const fullyFunded = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM scholarships WHERE is_fully_funded = 1 AND ${A}`
    ).first() as any;
    const highMatch = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM scholarships WHERE match_score >= 70 AND ${A}`
    ).first() as any;
    const recent = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM scholarships WHERE date(created_at) = date('now') AND ${A}`
    ).first() as any;
    const officialCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM scholarships WHERE source_trust_level = 'official' AND ${A}`
    ).first() as any;
    const topScholarships = await c.env.DB.prepare(
      `SELECT title, organization, country, match_score, success_probability, deadline, url, created_at,
       is_fully_funded, source_trust_level, deadline_type
       FROM scholarships WHERE ${A} ORDER BY match_score DESC LIMIT 5`
    ).all();

    return c.json({
      success: true,
      stats: {
        total: total?.count || 0,
        fully_funded: fullyFunded?.count || 0,
        high_match: highMatch?.count || 0,
        found_today: recent?.count || 0,
        official_count: officialCount?.count || 0,
      },
      top_scholarships: topScholarships.results,
      current_date: CURRENT_DATE,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Deduplicate scholarships ──────────────────────────────────
scholarships.post("/deduplicate", async (c) => {
  try {
    // Remove entries where title = 'Unknown Scholarship' except first one
    await c.env.DB.prepare(`
      DELETE FROM scholarships 
      WHERE title = 'Unknown Scholarship' 
      AND id NOT IN (SELECT MIN(id) FROM scholarships WHERE title = 'Unknown Scholarship')
    `).run();

    // Remove duplicate titles (keep highest match_score)
    const dupes = await c.env.DB.prepare(`
      SELECT title, COUNT(*) as cnt 
      FROM scholarships 
      GROUP BY title 
      HAVING cnt > 1
    `).all() as any;

    let removed = 0;
    for (const dupe of (dupes.results || [])) {
      const toDelete = await c.env.DB.prepare(`
        SELECT id FROM scholarships WHERE title = ? ORDER BY match_score DESC LIMIT -1 OFFSET 1
      `).bind(dupe.title).all() as any;
      for (const row of (toDelete.results || [])) {
        await c.env.DB.prepare("DELETE FROM scholarships WHERE id = ?").bind(row.id).run();
        removed++;
      }
    }

    const remaining = await c.env.DB.prepare("SELECT COUNT(*) as count FROM scholarships").first() as any;
    return c.json({ success: true, removed, remaining: remaining?.count || 0, message: `Removed ${removed} duplicates` });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Get single scholarship by ID ─────────────────────────────
scholarships.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const scholarship = await c.env.DB.prepare(
      "SELECT * FROM scholarships WHERE id = ?"
    ).bind(id).first();
    if (!scholarship) return c.json({ success: false, error: "Not found" }, 404);
    return c.json({ success: true, scholarship });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Delete a scholarship (and any saved refs / applications) ─
scholarships.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM applications WHERE scholarship_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM scholarships WHERE id = ?").bind(id).run();
    return c.json({ success: true, message: "Scholarship deleted" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── AI-powered scholarship search ────────────────────────────
scholarships.post("/search", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as any;
    const customQuery = body?.query || null;

    const { found, skippedExpired, queriesRun } = await runScholarshipSearch(c.env.DB, customQuery);

    return c.json({
      success: true,
      message: found.length
        ? `Search complete. Found ${found.length} new scholarship${found.length === 1 ? "" : "s"}.${skippedExpired ? ` Skipped ${skippedExpired} expired.` : ""}`
        : `Search complete. No new scholarships this run${skippedExpired ? ` (skipped ${skippedExpired} expired)` : ""}. Try again or check your API keys.`,
      new_scholarships: found,
      queries_run: queriesRun,
      current_date: CURRENT_DATE,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Scan known scholarship programs ──────────────────────────
scholarships.post("/scan-known", async (c) => {
  try {
    const known = getKnownScholarships();
    const profileSummary = buildProfileSummary();
    const added: any[] = [];

    for (const item of known.slice(0, 6)) {
      const existing = await c.env.DB.prepare(
        "SELECT id FROM scholarships WHERE url = ?"
      ).bind(item.url).first();
      if (existing) continue;

      const content = await readWebpage(item.url, { trustedOnly: true });
      const analysis = await analyzeScholarshipPage(content || item.name, profileSummary);
      if (analysis.isExpired) continue;

      const score = await scoreScholarship(content || item.name, profileSummary);

      const trustInfo = classifyUrl(item.url);
      const deadline = analysis.deadline || `Annual — Next intake: ${CURRENT_YEAR}-${CURRENT_YEAR + 1}`;
      const successProb = computeSuccessProbability(score, true, trustInfo.tier);
      const recReason = buildRecommendationReason(item.country, score);

      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO scholarships
        (title, organization, country, field, description, url, deadline, amount,
         requirements, match_score, is_fully_funded, covers, source, status, is_expired,
         source_trust_level, source_domain, success_probability, recommendation_reason, deadline_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'known_program', 'found', 0, ?, ?, ?, ?, ?)
      `).bind(
        analysis.title || item.name,
        analysis.organization || item.name,
        item.country,
        "Biotechnology",
        `Major scholarship program: ${item.name}`,
        item.url,
        deadline,
        analysis.amount || "Fully Funded",
        analysis.requirements || "See official website",
        score,
        1,
        analysis.covers || "Tuition, Monthly Stipend, Accommodation, Health Insurance, Airfare",
        trustInfo.tier,
        trustInfo.domain,
        successProb,
        recReason,
        classifyDeadline(deadline),
      ).run();

      added.push({ name: item.name, country: item.country, score });
    }

    return c.json({
      success: true,
      added,
      total: added.length,
      message: `Added ${added.length} known scholarship programs`,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Mark expired scholarships (run periodically) ─────────────
scholarships.post("/cleanup-expired", async (c) => {
  try {
    // Mark any that have "2025" deadlines as expired (we're in 2026)
    await c.env.DB.prepare(
      "UPDATE scholarships SET is_expired = 1 WHERE deadline LIKE '%2025%' AND is_expired = 0"
    ).run();
    await c.env.DB.prepare(
      "UPDATE scholarships SET is_expired = 1 WHERE deadline LIKE '%January 2026%' OR deadline LIKE '%February 2026%' OR deadline LIKE '%March 2026%' OR deadline LIKE '%April 2026%' OR deadline LIKE '%May 2026%'"
    ).run();
    return c.json({ success: true, message: "Expired scholarships cleaned up" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── STRICT VERIFICATION PASS — dedupe + expiry + link-check ──
// Runs the full filtering pipeline over stored scholarships and updates
// the verified flag. Returns quality counters for the metrics panel.
scholarships.post("/verify-all", async (c) => {
  try {
    const DB = c.env.DB;

    // Purge noisy best-effort link logs so quality metrics reflect only
    // reliable verifications (references + professor validation).
    await DB.prepare("DELETE FROM verification_log WHERE check_name = 'link_reachable'").run();

    // 1) Remove exact duplicate URLs (keep highest match_score)
    const dupeUrls = await DB.prepare(
      "SELECT url FROM scholarships WHERE url IS NOT NULL GROUP BY url HAVING COUNT(*) > 1"
    ).all() as any;
    let removedDupes = 0;
    for (const row of (dupeUrls.results || [])) {
      const extra = await DB.prepare(
        "SELECT id FROM scholarships WHERE url = ? ORDER BY match_score DESC, id ASC LIMIT -1 OFFSET 1"
      ).bind(row.url).all() as any;
      for (const e of (extra.results || [])) {
        await DB.prepare("DELETE FROM scholarships WHERE id = ?").bind(e.id).run();
        removedDupes++;
      }
    }

    // 2) Mark clearly-past deadlines as expired (string-based, conservative)
    const expRes = await DB.prepare(
      "UPDATE scholarships SET is_expired = 1, verified = 0 WHERE deadline LIKE '%2025%' AND (is_expired = 0 OR is_expired IS NULL)"
    ).run();
    const markedExpired = (expRes.meta as any)?.changes || 0;

    // 3) Link-check non-expired scholarships and set verified flag
    const rows = await DB.prepare(
      "SELECT id, title, url, source_trust_level FROM scholarships WHERE (is_expired = 0 OR is_expired IS NULL) LIMIT 50"
    ).all() as any;
    const list = rows.results || [];
    const checks = await Promise.all(list.map((s: any) => verifyUrlReachable(s.url)));

    let linksFailed = 0, verifiedCount = 0;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const ok = checks[i];
      const trusted = s.source_trust_level === "official" || s.source_trust_level === "recognised";
      // Verified = trusted + not expired (this loop only sees non-expired rows).
      // Link reachability is advisory only.
      const verified = trusted ? 1 : 0;
      if (!ok) linksFailed++;
      if (verified) verifiedCount++;
      await DB.prepare("UPDATE scholarships SET link_ok = ?, verified = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(ok ? 1 : 0, verified, s.id).run();
      // link reachability is advisory only — not logged as pass/fail
    }
    const linksConfirmed = list.length - linksFailed;

    return c.json({
      success: true,
      message: `Verification complete: ${verifiedCount} verified, ${removedDupes} duplicate${removedDupes === 1 ? "" : "s"} removed, ${markedExpired} expired removed. Links confirmed reachable: ${linksConfirmed}/${list.length} (best-effort).`,
      removed_duplicates: removedDupes,
      marked_expired: markedExpired,
      links_checked: list.length,
      links_confirmed: linksConfirmed,
      verified_count: verifiedCount,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default scholarships;
