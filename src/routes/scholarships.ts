import { Hono } from "hono";
import { searchScholarships, readWebpage, buildSearchQueries, getKnownScholarships, classifyUrl } from "../lib/search";
import { scoreScholarship, analyzeScholarshipPage } from "../lib/ai";
import { buildProfileSummary, USER_PROFILE, CURRENT_DATE, CURRENT_YEAR } from "../lib/profile";
import { computeSuccessProbability, buildRecommendationReason, classifyDeadline } from "../lib/scoring";

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

  // 4) Store the keepers
  const found: any[] = [];
  let skippedExpired = 0;
  for (const item of analyses) {
    if (!item) continue;
    const { r, analysis } = item;
    if (analysis.isExpired) { skippedExpired++; continue; }

    const trustInfo = classifyUrl(r.url);
    const finalScore = analysis.matchScore || 50;
    const detectedCountry = analysis.country ||
      USER_PROFILE.targetCountries.find(tc =>
        (analysis.organization + r.url + r.title).toLowerCase().includes(tc.toLowerCase())
      ) || "International";
    const deadline = analysis.deadline || `Check website (${CURRENT_YEAR}-${CURRENT_YEAR + 1} intake)`;
    const isFunded = !!analysis.isFullyFunded;
    const successProb = computeSuccessProbability(finalScore, isFunded, trustInfo.tier);
    const recReason = buildRecommendationReason(detectedCountry, finalScore);

    await DB.prepare(`
      INSERT OR IGNORE INTO scholarships
      (title, organization, country, field, description, url, deadline, amount,
       requirements, match_score, is_fully_funded, covers, source,
       raw_content, status, is_expired, source_trust_level, source_domain,
       success_probability, recommendation_reason, deadline_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'found', 0, ?, ?, ?, ?, ?)
    `).bind(
      analysis.title || r.title,
      analysis.organization || r.source || "Unknown",
      detectedCountry,
      "Biotechnology",
      r.snippet,
      r.url,
      deadline,
      analysis.amount || "Fully Funded",
      analysis.requirements || "See website",
      finalScore,
      isFunded ? 1 : 0,
      analysis.covers || "Tuition, Stipend, Accommodation",
      r.source || "web",
      (r.snippet || "").substring(0, 2000),
      trustInfo.tier,
      trustInfo.domain,
      successProb,
      recReason,
      classifyDeadline(deadline),
    ).run();

    found.push({ title: analysis.title || r.title, url: r.url, score: finalScore, deadline, country: detectedCountry, success_probability: successProb });
  }

  return { found, skippedExpired, queriesRun: queries.length };
}

// ── Get all scholarships from DB ─────────────────────────────
scholarships.get("/", async (c) => {
  try {
    const { status, country, limit = "50", page = "1", trust, funded } = c.req.query();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = "SELECT * FROM scholarships WHERE is_expired = 0 OR is_expired IS NULL";
    const params: any[] = [];

    if (status) { query += " AND status = ?"; params.push(status); }
    if (country) { query += " AND country LIKE ?"; params.push(`%${country}%`); }
    if (trust) { query += " AND source_trust_level = ?"; params.push(trust); }
    if (funded === "1") { query += " AND is_fully_funded = 1"; }

    query += " ORDER BY match_score DESC, created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit), offset);

    const results = await c.env.DB.prepare(query).bind(...params).all();
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM scholarships WHERE is_expired = 0 OR is_expired IS NULL"
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
    const total = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM scholarships WHERE is_expired = 0 OR is_expired IS NULL"
    ).first() as any;
    const fullyFunded = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM scholarships WHERE is_fully_funded = 1 AND (is_expired = 0 OR is_expired IS NULL)"
    ).first() as any;
    const highMatch = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM scholarships WHERE match_score >= 70 AND (is_expired = 0 OR is_expired IS NULL)"
    ).first() as any;
    const recent = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM scholarships WHERE date(created_at) = date('now')"
    ).first() as any;
    const officialCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM scholarships WHERE source_trust_level = 'official' AND (is_expired = 0 OR is_expired IS NULL)"
    ).first() as any;
    const topScholarships = await c.env.DB.prepare(
      `SELECT title, organization, country, match_score, success_probability, deadline, url, 
       is_fully_funded, source_trust_level, deadline_type
       FROM scholarships WHERE is_expired = 0 OR is_expired IS NULL ORDER BY match_score DESC LIMIT 5`
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

export default scholarships;
