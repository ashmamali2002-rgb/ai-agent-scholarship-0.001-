import { Hono } from "hono";
import { generateResume, generatePersonalStatement, generateCoverLetter, generateResearchProposal } from "../lib/ai";
import { normalizeProfile } from "../lib/profile";
import { verifyDocumentReferences, logVerification } from "../lib/verify";
import { currentUser } from "./auth";
import { supaRest } from "../lib/supabase";

type Bindings = { DB: D1Database };
const documents = new Hono<{ Bindings: Bindings }>();

// Build the logged-in user's document-generation profile from Supabase.
async function getGenProfile(sess: any): Promise<any> {
  const [prof, pubs, acad] = await Promise.all([
    supaRest("profiles", { accessToken: sess.accessToken, query: "select=*" }).catch(() => []),
    supaRest("publications", { accessToken: sess.accessToken, query: "select=*&order=year.desc.nullslast" }).catch(() => []),
    supaRest("academic_records", { accessToken: sess.accessToken, query: "select=*" }).catch(() => []),
  ]);
  const row: any = (prof && prof[0]) || {};
  row.email = sess.user.email;
  return normalizeProfile(row, pubs || [], acad || []);
}

// Save a generated document to the user's Supabase documents table (RLS-scoped).
async function saveDoc(sess: any, d: { type: string; title: string; content: string; refsTotal?: number; refsVerified?: number }) {
  const res = await supaRest("documents", {
    method: "POST",
    accessToken: sess.accessToken,
    body: {
      user_id: sess.user.id, type: d.type, title: d.title, content: d.content,
      references_total: d.refsTotal || 0, references_verified: d.refsVerified || 0,
    },
    prefer: "return=representation",
  });
  return (res && res[0]) || null;
}

// Look up scholarship context from the shared D1 pool (for title/org/field).
async function scholarshipCtx(DB: D1Database, scholarshipId: any) {
  if (!scholarshipId) return null;
  try { return await DB.prepare("SELECT * FROM scholarships WHERE id = ?").bind(scholarshipId).first() as any; }
  catch { return null; }
}

// ── List the user's documents ────────────────────────────────
documents.get("", async (c) => c.redirect("/api/documents/list"));
documents.get("/list", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const { type } = c.req.query();
    let q = "select=id,type,title,references_total,references_verified,created_at&order=created_at.desc";
    if (type) q += `&type=eq.${encodeURIComponent(type)}`;
    const rows = await supaRest("documents", { accessToken: sess.accessToken, query: q });
    return c.json({ success: true, documents: rows || [] });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ── Readiness (before /:id) ──────────────────────────────────
documents.get("/readiness", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const REQUIRED = [
      { type: "resume", label: "Academic CV / Resume" },
      { type: "cover_letter", label: "Cover Letter" },
      { type: "personal_statement", label: "Personal Statement" },
      { type: "research_proposal", label: "Research Proposal" },
    ];
    const rows = await supaRest("documents", { accessToken: sess.accessToken, query: "select=type" });
    const present = new Set((rows || []).map((r: any) => r.type));
    const generated = REQUIRED.filter(d => present.has(d.type));
    const missing = REQUIRED.filter(d => !present.has(d.type));
    return c.json({
      success: true, required: REQUIRED, generated, missing,
      readiness_score: Math.round((generated.length / REQUIRED.length) * 100),
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ── Get one document ─────────────────────────────────────────
documents.get("/:id", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const rows = await supaRest("documents", { accessToken: sess.accessToken, query: `id=eq.${c.req.param("id")}&select=*` });
    const doc = rows && rows[0];
    if (!doc) return c.json({ success: false, error: "Document not found" }, 404);
    return c.json({ success: true, document: doc });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ── Generators ───────────────────────────────────────────────
documents.post("/generate/resume", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const { scholarship_id, scholarship_title, field } = await c.req.json().catch(() => ({}));
    const sch = await scholarshipCtx(c.env.DB, scholarship_id);
    const title = scholarship_title || sch?.title || "Scholarship";
    const fld = field || sch?.field || "your field";
    const profile = await getGenProfile(sess);
    const content = await generateResume(title, fld, profile);
    const doc = await saveDoc(sess, { type: "resume", title: `Resume for ${title}`, content });
    return c.json({ success: true, document_id: doc?.id, type: "resume", title: doc?.title, content });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

documents.post("/generate/personal-statement", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const { scholarship_id, scholarship_title, organization, country, field } = await c.req.json().catch(() => ({}));
    const sch = await scholarshipCtx(c.env.DB, scholarship_id);
    const title = scholarship_title || sch?.title || "Scholarship";
    const org = organization || sch?.organization || "Scholarship Committee";
    const ctry = country || sch?.country || "International";
    const fld = field || sch?.field || "your field";
    const profile = await getGenProfile(sess);
    const content = await generatePersonalStatement(title, org, ctry, fld, profile);
    const doc = await saveDoc(sess, { type: "personal_statement", title: `Personal Statement for ${title}`, content });
    return c.json({ success: true, document_id: doc?.id, type: "personal_statement", title: doc?.title, content });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

documents.post("/generate/cover-letter", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const { scholarship_id, scholarship_title, organization, country } = await c.req.json().catch(() => ({}));
    const sch = await scholarshipCtx(c.env.DB, scholarship_id);
    const title = scholarship_title || sch?.title || "Scholarship";
    const org = organization || sch?.organization || "Scholarship Committee";
    const ctry = country || sch?.country || "International";
    const profile = await getGenProfile(sess);
    const content = await generateCoverLetter(title, org, ctry, profile);
    const doc = await saveDoc(sess, { type: "cover_letter", title: `Cover Letter for ${title}`, content });
    return c.json({ success: true, document_id: doc?.id, type: "cover_letter", title: doc?.title, content });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

documents.post("/generate/research-proposal", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const { scholarship_id, scholarship_title, field } = await c.req.json().catch(() => ({}));
    const sch = await scholarshipCtx(c.env.DB, scholarship_id);
    const title = scholarship_title || sch?.title || "Research Scholarship";
    const fld = field || sch?.field || "your field";
    const profile = await getGenProfile(sess);
    const raw = await generateResearchProposal(title, fld, profile);
    const ver = await verifyDocumentReferences(raw);
    await logVerification(c.env.DB, "reference", `Research Proposal for ${title}`, "crossref", ver.unverified ? "fail" : "pass", `${ver.verified}/${ver.total} verified`);
    const doc = await saveDoc(sess, { type: "research_proposal", title: `Research Proposal for ${title}`, content: ver.content, refsTotal: ver.total, refsVerified: ver.verified });
    return c.json({ success: true, document_id: doc?.id, type: "research_proposal", title: doc?.title, content: ver.content, references: ver });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ── Generate all 4 at once ───────────────────────────────────
documents.post("/generate/all", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const { scholarship_id } = await c.req.json().catch(() => ({}));
    const sch = await scholarshipCtx(c.env.DB, scholarship_id);
    const title = sch?.title || "Scholarship Application";
    const org = sch?.organization || "Scholarship Committee";
    const country = sch?.country || "International";
    const field = sch?.field || "your field";
    const profile = await getGenProfile(sess);

    const [resume, personalStatement, coverLetter, researchRaw] = await Promise.all([
      generateResume(title, field, profile),
      generatePersonalStatement(title, org, country, field, profile),
      generateCoverLetter(title, org, country, profile),
      generateResearchProposal(title, field, profile),
    ]);
    const ver = await verifyDocumentReferences(researchRaw);
    await logVerification(c.env.DB, "reference", `Research Proposal for ${title}`, "crossref", ver.unverified ? "fail" : "pass", `${ver.verified}/${ver.total} verified`);

    const docs = [
      { type: "resume", title: `Resume for ${title}`, content: resume },
      { type: "personal_statement", title: `Personal Statement for ${title}`, content: personalStatement },
      { type: "cover_letter", title: `Cover Letter for ${title}`, content: coverLetter },
      { type: "research_proposal", title: `Research Proposal for ${title}`, content: ver.content, refsTotal: ver.total, refsVerified: ver.verified },
    ];
    for (const d of docs) await saveDoc(sess, d);
    return c.json({ success: true, message: "All 4 documents generated for your profile", documents: docs.map(d => ({ type: d.type, title: d.title })) });
  } catch (e: any) { return c.json({ success: false, error: e.message }, 500); }
});

// ── Delete a document ────────────────────────────────────────
documents.delete("/:id", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    await supaRest("documents", { method: "DELETE", accessToken: sess.accessToken, query: `id=eq.${c.req.param("id")}` });
    return c.json({ success: true, message: "Document deleted" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export default documents;
