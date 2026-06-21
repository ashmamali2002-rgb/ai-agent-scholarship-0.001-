import { Hono } from "hono";
import { generateResume, generatePersonalStatement, generateCoverLetter, generateResearchProposal } from "../lib/ai";
import { USER_PROFILE } from "../lib/profile";

type Bindings = { DB: D1Database };
const documents = new Hono<{ Bindings: Bindings }>();

// Get all documents
documents.get("", async (c) => {
  return c.redirect("/api/documents/list");
});
documents.get("/list", async (c) => {
  try {
    const { type, scholarship_id } = c.req.query();
    let query = "SELECT id, user_id, application_id, scholarship_id, type, title, version, created_at FROM documents WHERE user_id = 1";
    const params: any[] = [];

    if (type) { query += " AND type = ?"; params.push(type); }
    if (scholarship_id) { query += " AND scholarship_id = ?"; params.push(scholarship_id); }
    query += " ORDER BY created_at DESC";

    const results = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, documents: results.results });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Readiness: which of the 4 core documents exist, what's missing, and a score
// NOTE: must be registered BEFORE "/:id" or Hono matches "readiness" as an id.
documents.get("/readiness", async (c) => {
  try {
    const { scholarship_id } = c.req.query();
    const REQUIRED = [
      { type: "resume", label: "Academic CV / Resume" },
      { type: "cover_letter", label: "Cover Letter" },
      { type: "personal_statement", label: "Personal Statement" },
      { type: "research_proposal", label: "Research Proposal" },
    ];

    let query = "SELECT DISTINCT type FROM documents WHERE user_id = 1";
    const params: any[] = [];
    if (scholarship_id) { query += " AND scholarship_id = ?"; params.push(scholarship_id); }

    const rows = await c.env.DB.prepare(query).bind(...params).all();
    const present = new Set((rows.results as any[]).map(r => r.type));

    const generated = REQUIRED.filter(d => present.has(d.type));
    const missing = REQUIRED.filter(d => !present.has(d.type));
    const readiness = Math.round((generated.length / REQUIRED.length) * 100);

    return c.json({
      success: true,
      required: REQUIRED,
      generated,
      missing,
      readiness_score: readiness,
      scholarship_id: scholarship_id || null,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get document content
documents.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const doc = await c.env.DB.prepare("SELECT * FROM documents WHERE id = ? AND user_id = 1").bind(id).first();
    if (!doc) return c.json({ success: false, error: "Document not found" }, 404);
    return c.json({ success: true, document: doc });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Generate resume for a scholarship
documents.post("/generate/resume", async (c) => {
  try {
    const { scholarship_id, scholarship_title, scholarship_field } = await c.req.json();

    const title = scholarship_title || "General Scholarship";
    const field = scholarship_field || "Biotechnology";

    const content = await generateResume(title, field, USER_PROFILE);

    const result = await c.env.DB.prepare(`
      INSERT INTO documents (user_id, scholarship_id, type, title, content) 
      VALUES (1, ?, 'resume', ?, ?)
    `).bind(scholarship_id || null, `Resume for ${title}`, content).run();

    return c.json({
      success: true,
      document_id: result.meta.last_row_id,
      type: "resume",
      title: `Resume for ${title}`,
      content,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Generate personal statement
documents.post("/generate/personal-statement", async (c) => {
  try {
    const { scholarship_id, scholarship_title, organization, country, field } = await c.req.json();

    const title = scholarship_title || "General Scholarship";
    const org = organization || "Scholarship Committee";
    const ctry = country || "International";
    const fld = field || "Biotechnology";

    const content = await generatePersonalStatement(title, org, ctry, fld, USER_PROFILE);

    const result = await c.env.DB.prepare(`
      INSERT INTO documents (user_id, scholarship_id, type, title, content) 
      VALUES (1, ?, 'personal_statement', ?, ?)
    `).bind(scholarship_id || null, `Personal Statement for ${title}`, content).run();

    return c.json({
      success: true,
      document_id: result.meta.last_row_id,
      type: "personal_statement",
      title: `Personal Statement for ${title}`,
      content,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Generate cover letter
documents.post("/generate/cover-letter", async (c) => {
  try {
    const { scholarship_id, scholarship_title, organization, country } = await c.req.json();

    const title = scholarship_title || "General Scholarship";
    const org = organization || "Scholarship Committee";
    const ctry = country || "International";

    const content = await generateCoverLetter(title, org, ctry, USER_PROFILE);

    const result = await c.env.DB.prepare(`
      INSERT INTO documents (user_id, scholarship_id, type, title, content) 
      VALUES (1, ?, 'cover_letter', ?, ?)
    `).bind(scholarship_id || null, `Cover Letter for ${title}`, content).run();

    return c.json({
      success: true,
      document_id: result.meta.last_row_id,
      type: "cover_letter",
      title: `Cover Letter for ${title}`,
      content,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Generate research proposal
documents.post("/generate/research-proposal", async (c) => {
  try {
    const { scholarship_id, scholarship_title, field } = await c.req.json();

    const title = scholarship_title || "Research Scholarship";
    const fld = field || "Biotechnology";

    const content = await generateResearchProposal(title, fld, USER_PROFILE);

    const result = await c.env.DB.prepare(`
      INSERT INTO documents (user_id, scholarship_id, type, title, content) 
      VALUES (1, ?, 'research_proposal', ?, ?)
    `).bind(scholarship_id || null, `Research Proposal for ${title}`, content).run();

    return c.json({
      success: true,
      document_id: result.meta.last_row_id,
      type: "research_proposal",
      title: `Research Proposal for ${title}`,
      content,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Generate ALL documents for a scholarship at once
documents.post("/generate/all", async (c) => {
  try {
    const { scholarship_id } = await c.req.json();

    // Get scholarship details
    let scholarship: any = null;
    if (scholarship_id) {
      scholarship = await c.env.DB.prepare("SELECT * FROM scholarships WHERE id = ?").bind(scholarship_id).first();
    }

    const title = scholarship?.title || "Scholarship Application";
    const org = scholarship?.organization || "Scholarship Committee";
    const country = scholarship?.country || "International";
    const field = scholarship?.field || "Biotechnology";

    const [resume, personalStatement, coverLetter, researchProposal] = await Promise.all([
      generateResume(title, field, USER_PROFILE),
      generatePersonalStatement(title, org, country, field, USER_PROFILE),
      generateCoverLetter(title, org, country, USER_PROFILE),
      generateResearchProposal(title, field, USER_PROFILE),
    ]);

    const docs = [
      { type: "resume", title: `Resume for ${title}`, content: resume },
      { type: "personal_statement", title: `Personal Statement for ${title}`, content: personalStatement },
      { type: "cover_letter", title: `Cover Letter for ${title}`, content: coverLetter },
      { type: "research_proposal", title: `Research Proposal for ${title}`, content: researchProposal },
    ];

    const ids: number[] = [];
    for (const doc of docs) {
      const result = await c.env.DB.prepare(`
        INSERT INTO documents (user_id, scholarship_id, type, title, content) 
        VALUES (1, ?, ?, ?, ?)
      `).bind(scholarship_id || null, doc.type, doc.title, doc.content).run();
      ids.push(result.meta.last_row_id as number);
    }

    return c.json({
      success: true,
      message: "All 4 documents generated successfully",
      document_ids: ids,
      documents: docs.map((d, i) => ({ id: ids[i], type: d.type, title: d.title })),
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Delete document
documents.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM documents WHERE id = ? AND user_id = 1").bind(id).run();
    return c.json({ success: true, message: "Document deleted" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default documents;
