// ============================================================
// GETSCO — Professor Finder Route
// Finds department faculty, research focus, emails, LinkedIn
// Only operates on official university pages
// ============================================================

import { Hono } from "hono";
import { analyzeProfessorPage, analyzeUniversityDepartment } from "../lib/ai";
import { readWebpage, searchProfessors } from "../lib/search";
import { buildProfileSummary } from "../lib/profile";

type Bindings = { DB: D1Database };
const professors = new Hono<{ Bindings: Bindings }>();

// ── List all saved professors ─────────────────────────────────
professors.get("/", async (c) => {
  try {
    const { university, country, min_score } = c.req.query();
    let query = "SELECT * FROM professors WHERE 1=1";
    const params: any[] = [];

    if (university) { query += " AND university LIKE ?"; params.push(`%${university}%`); }
    if (country) { query += " AND country LIKE ?"; params.push(`%${country}%`); }
    if (min_score) { query += " AND relevance_score >= ?"; params.push(parseInt(min_score)); }

    query += " ORDER BY relevance_score DESC, created_at DESC LIMIT 50";

    const results = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, professors: results.results, count: results.results.length });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── Search professors for a specific university ──────────────
professors.post("/search", async (c) => {
  try {
    const body = await c.req.json() as any;
    const university = body.university || "";
    const department = body.department || "Biotechnology";
    const country = body.country || "";
    const profileUrl = body.profile_url || ""; // optional: direct faculty page URL

    if (!university) return c.json({ success: false, error: "University name is required" }, 400);

    const profileSummary = buildProfileSummary();
    const found: any[] = [];

    // Strategy 1: direct faculty page URL if provided
    if (profileUrl) {
      const pageContent = await readWebpage(profileUrl);
      if (pageContent) {
        const profs = await analyzeProfessorPage(pageContent, university, department, profileSummary);
        for (const prof of profs) {
          if (prof.relevanceScore < 30) continue;
          const existing = await c.env.DB.prepare(
            "SELECT id FROM professors WHERE university = ? AND name = ?"
          ).bind(university, prof.name).first();
          if (existing) continue;
          await c.env.DB.prepare(`
            INSERT INTO professors (university, department, country, name, title, email, linkedin_url, profile_url, research_interests, lab_name, accepting_students, relevance_score, raw_bio, source_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            university, department, country,
            prof.name, prof.title, prof.email,
            prof.linkedinUrl, prof.profileUrl,
            prof.researchInterests, prof.labName,
            prof.acceptingStudents, prof.relevanceScore,
            prof.rawBio, profileUrl
          ).run();
          found.push(prof);
        }
      }
    }

    // Strategy 2: web search for faculty pages
    if (found.length < 3) {
      const searchResults = await searchProfessors(university, department, country);
      for (const result of searchResults.slice(0, 3)) {
        const pageContent = await readWebpage(result.url);
        if (!pageContent) continue;

        const profs = await analyzeProfessorPage(pageContent, university, department, profileSummary);
        for (const prof of profs.filter(p => p.relevanceScore >= 35)) {
          const existing = await c.env.DB.prepare(
            "SELECT id FROM professors WHERE university = ? AND name = ?"
          ).bind(university, prof.name).first();
          if (existing) continue;
          await c.env.DB.prepare(`
            INSERT INTO professors (university, department, country, name, title, email, linkedin_url, profile_url, research_interests, lab_name, accepting_students, relevance_score, raw_bio, source_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            university, department, country,
            prof.name, prof.title, prof.email,
            prof.linkedinUrl, prof.profileUrl,
            prof.researchInterests, prof.labName,
            prof.acceptingStudents, prof.relevanceScore,
            prof.rawBio, result.url
          ).run();
          found.push(prof);
        }
      }
    }

    return c.json({
      success: true,
      message: `Found ${found.length} relevant professors at ${university}`,
      professors: found,
      university,
      department,
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
    const departmentUrl = body.department_url || "";

    if (!university) return c.json({ success: false, error: "University name is required" }, 400);

    const profileSummary = buildProfileSummary();

    let pageContent = "";
    if (departmentUrl) {
      pageContent = await readWebpage(departmentUrl) || "";
    }

    // If no URL provided, search for the department page
    if (!pageContent) {
      const results = await searchProfessors(university, "Biotechnology Molecular Biology", country);
      if (results.length > 0) {
        pageContent = await readWebpage(results[0].url) || "";
      }
    }

    if (!pageContent) {
      return c.json({ success: false, error: "Could not retrieve department page. Please provide department_url." }, 400);
    }

    const analysis = await analyzeUniversityDepartment(pageContent, university, country, profileSummary);

    return c.json({
      success: true,
      university,
      country,
      analysis,
    });
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
