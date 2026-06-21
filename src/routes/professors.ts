// ============================================================
// GETSCO — Professor Finder Route
// Global, field-aware faculty discovery + research compatibility.
// Targets the correct department per field, prioritises official
// university sources, and never fabricates contact details.
// ============================================================

import { Hono } from "hono";
import { analyzeProfessorPage, analyzeUniversityDepartment, type ProfessorRecord } from "../lib/ai";
import { readWebpage, searchProfessors } from "../lib/search";
import { buildProfileSummary } from "../lib/profile";
import { mapFieldToDepartments } from "../lib/departments";

type Bindings = { DB: D1Database };
const professors = new Hono<{ Bindings: Bindings }>();

// Allowed sort columns -> SQL
const SORTS: Record<string, string> = {
  compatibility: "relevance_score DESC",
  country: "country ASC, relevance_score DESC",
  research: "research_interests ASC, relevance_score DESC",
  university: "university ASC, relevance_score DESC",
};

// ── List saved professors (with sort) ─────────────────────────
professors.get("/", async (c) => {
  try {
    const { university, country, min_score, sort, field } = c.req.query();
    let query = "SELECT * FROM professors WHERE 1=1";
    const params: any[] = [];

    if (university) { query += " AND university LIKE ?"; params.push(`%${university}%`); }
    if (country) { query += " AND country LIKE ?"; params.push(`%${country}%`); }
    if (field) { query += " AND field LIKE ?"; params.push(`%${field}%`); }
    if (min_score) { query += " AND relevance_score >= ?"; params.push(parseInt(min_score)); }

    query += ` ORDER BY ${SORTS[sort || "compatibility"] || SORTS.compatibility} LIMIT 60`;

    const results = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, professors: results.results, count: results.results.length });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Persist one professor (anti-fabrication: verify email vs source) ──
async function persistProfessor(
  DB: D1Database,
  prof: ProfessorRecord,
  ctx: { university: string; department: string; country: string; field: string; sourceUrl: string; verifyText: string; scholarshipId: number | null; recommendationType: string }
): Promise<boolean> {
  // Keep an email/scholar/profile link ONLY if it actually appears in the
  // page we read — this blocks AI-invented contact details.
  const txt = (ctx.verifyText || "").toLowerCase();
  const verify = (val: string) => (val && txt.includes(val.toLowerCase()) ? val : "");
  const email = verify(prof.email);
  const scholar = verify(prof.googleScholarUrl);
  const linkedin = verify(prof.linkedinUrl);

  const existing = await DB.prepare("SELECT id FROM professors WHERE name = ? AND university = ?")
    .bind(prof.name, ctx.university).first();
  if (existing) return false;

  await DB.prepare(`
    INSERT INTO professors
    (university, department, country, field, name, title, email, linkedin_url, profile_url,
     research_interests, lab_name, lab_website, google_scholar_url, recent_publications,
     accepting_students, relevance_score, matched_topics, matched_keywords,
     recommendation_reason, raw_bio, source_url, scholarship_id, recommendation_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    ctx.university, ctx.department, ctx.country, ctx.field,
    prof.name, prof.title, email, linkedin, prof.profileUrl,
    prof.researchInterests, prof.labName, prof.labWebsite, scholar,
    JSON.stringify(prof.recentPublications || []),
    prof.acceptingStudents, prof.relevanceScore,
    JSON.stringify(prof.matchedTopics || []), JSON.stringify(prof.matchedKeywords || []),
    prof.recommendationReason, prof.rawBio, ctx.sourceUrl,
    ctx.scholarshipId, ctx.recommendationType,
  ).run();
  return true;
}

// ── Search professors — global, field-aware ──────────────────
professors.post("/search", async (c) => {
  try {
    const body = await c.req.json() as any;
    const university = (body.university || "").trim();
    // Accept either `field` (new) or legacy `department`
    const field = (body.field || body.department || "Biotechnology").trim();
    const country = body.country || "";
    const profileUrl = body.profile_url || "";
    const scholarshipId = body.scholarship_id ? parseInt(body.scholarship_id) : null;
    const recommendationType = university ? "university" : "government";

    // University OR field is enough — field-only runs a global discovery.
    if (!university && !field) {
      return c.json({ success: false, error: "Provide a university or a field of study." }, 400);
    }

    const profileSummary = buildProfileSummary();
    const { departments } = mapFieldToDepartments(field);
    const department = departments[0];
    const found: ProfessorRecord[] = [];
    let searchedPages = 0;
    let pagesRead = 0;

    const ctxBase = { university, department, country, field, scholarshipId, recommendationType };

    // Strategy 1: direct faculty page URL
    if (profileUrl) {
      const pageContent = await readWebpage(profileUrl);
      if (pageContent) {
        pagesRead++;
        const profs = await analyzeProfessorPage(pageContent, university || department, field, profileSummary);
        for (const prof of profs.filter(p => p.relevanceScore >= 30)) {
          if (await persistProfessor(c.env.DB, prof, { ...ctxBase, sourceUrl: profileUrl, verifyText: pageContent })) found.push(prof);
        }
      }
    }

    // Strategy 2: web search for faculty pages (field-aware, global)
    if (found.length < 4) {
      const searchResults = await searchProfessors(university, field, country);
      searchedPages = searchResults.length;
      for (const result of searchResults.slice(0, 5)) {
        const pageContent = await readWebpage(result.url);
        if (pageContent) pagesRead++;
        const content = pageContent || `${result.title}\n${result.snippet}`;
        if (!content.trim()) continue;

        const profs = await analyzeProfessorPage(content, university || department, field, profileSummary);
        for (const prof of profs.filter(p => p.relevanceScore >= 30)) {
          if (await persistProfessor(c.env.DB, prof, { ...ctxBase, sourceUrl: result.url, verifyText: content })) found.push(prof);
        }
        if (found.length >= 8) break;
      }
    }

    const where = university || `the ${field} field`;
    const message = found.length
      ? `Found ${found.length} relevant professor${found.length === 1 ? "" : "s"} for ${where}`
      : searchedPages === 0
        ? `No faculty pages found for ${where}. Try pasting an official faculty/people page URL.`
        : `Searched ${searchedPages} page(s) but couldn't verify matching professors. Paste the department's official faculty page URL for a precise read.`;

    return c.json({
      success: true,
      message,
      professors: found,
      university,
      field,
      department,
      recommendation_type: recommendationType,
      note: recommendationType === "government"
        ? "These are independent supervisor suggestions based on your research interests — they are not affiliated with the scholarship provider."
        : undefined,
      debug: { searched_pages: searchedPages, pages_read: pagesRead },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Analyse a university department ──────────────────────────
professors.post("/analyse-department", async (c) => {
  try {
    const body = await c.req.json() as any;
    const university = body.university || "";
    const country = body.country || "";
    const field = (body.field || body.department || "Biotechnology").trim();
    const departmentUrl = body.department_url || "";

    if (!university) return c.json({ success: false, error: "University name is required" }, 400);

    const profileSummary = buildProfileSummary();

    let pageContent = "";
    if (departmentUrl) pageContent = await readWebpage(departmentUrl) || "";
    if (!pageContent) {
      const results = await searchProfessors(university, field, country);
      if (results.length > 0) pageContent = await readWebpage(results[0].url) || "";
    }
    if (!pageContent) {
      return c.json({ success: false, error: "Could not retrieve department page. Please provide department_url." }, 400);
    }

    const analysis = await analyzeUniversityDepartment(pageContent, university, country, profileSummary);
    return c.json({ success: true, university, country, field, analysis });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Get professor by ID ───────────────────────────────────────
professors.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const prof = await c.env.DB.prepare("SELECT * FROM professors WHERE id = ?").bind(id).first();
    if (!prof) return c.json({ success: false, error: "Professor not found" }, 404);
    return c.json({ success: true, professor: prof });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Delete professor record ───────────────────────────────────
professors.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM professors WHERE id = ?").bind(id).run();
    return c.json({ success: true, message: "Deleted" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default professors;
