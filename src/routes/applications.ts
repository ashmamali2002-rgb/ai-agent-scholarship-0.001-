import { Hono } from "hono";
import { generateCoverLetter, generatePersonalStatement } from "../lib/ai";
import { sendApplicationEmail, sendNotificationToUser } from "../lib/email";
import { normalizeProfile } from "../lib/profile";
import { currentUser } from "./auth";
import { supaRest } from "../lib/supabase";

type Bindings = { DB: D1Database };
const applications = new Hono<{ Bindings: Bindings }>();

// Build the logged-in user's profile for document generation.
async function genProfile(sess: any): Promise<any> {
  const [prof, pubs, acad] = await Promise.all([
    supaRest("profiles", { accessToken: sess.accessToken, query: "select=*" }).catch(() => []),
    supaRest("publications", { accessToken: sess.accessToken, query: "select=*" }).catch(() => []),
    supaRest("academic_records", { accessToken: sess.accessToken, query: "select=*" }).catch(() => []),
  ]);
  const row: any = (prof && prof[0]) || {};
  row.email = sess.user.email;
  return normalizeProfile(row, pubs || [], acad || []);
}

// Get all applications
applications.get("/", async (c) => {
  try {
    const { status } = c.req.query();
    let query = `
      SELECT a.*, s.title as scholarship_title, s.organization, s.country, s.deadline, s.match_score, s.url as scholarship_url
      FROM applications a
      LEFT JOIN scholarships s ON a.scholarship_id = s.id
      WHERE a.user_id = 1
    `;
    const params: any[] = [];
    if (status) { query += " AND a.status = ?"; params.push(status); }
    query += " ORDER BY a.created_at DESC";

    const results = await c.env.DB.prepare(query).bind(...params).all();
    return c.json({ success: true, applications: results.results });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Create a new application
applications.post("/", async (c) => {
  try {
    const { scholarship_id, notes } = await c.req.json();

    // Check if already applied
    const existing = await c.env.DB.prepare(
      "SELECT id FROM applications WHERE user_id = 1 AND scholarship_id = ?"
    ).bind(scholarship_id).first();

    if (existing) {
      return c.json({ success: false, error: "Already applied to this scholarship" }, 400);
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO applications (user_id, scholarship_id, status, notes)
      VALUES (1, ?, 'preparing', ?)
    `).bind(scholarship_id, notes || "").run();

    // Update scholarship status
    await c.env.DB.prepare("UPDATE scholarships SET status = 'applying' WHERE id = ?").bind(scholarship_id).run();

    return c.json({
      success: true,
      application_id: result.meta.last_row_id,
      message: "Application started. Generating documents...",
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Update application status
applications.put("/:id/status", async (c) => {
  try {
    const id = c.req.param("id");
    const { status, notes } = await c.req.json();

    await c.env.DB.prepare(`
      UPDATE applications SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = 1
    `).bind(status, notes || "", id).run();

    return c.json({ success: true, message: "Application updated" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Send application via email
applications.post("/:id/send-email", async (c) => {
  try {
    const sess = await currentUser(c);
    if (!sess) return c.json({ success: false, authenticated: false }, 401);
    const appId = c.req.param("id");
    const { recipient_email } = await c.req.json();

    // Get application details
    const app = await c.env.DB.prepare(`
      SELECT a.*, s.title as scholarship_title, s.organization, s.country, s.field, s.url
      FROM applications a
      LEFT JOIN scholarships s ON a.scholarship_id = s.id
      WHERE a.id = ? AND a.user_id = 1
    `).bind(appId).first() as any;

    if (!app) return c.json({ success: false, error: "Application not found" }, 404);

    // Generate fresh documents from THIS user's profile
    const profile = await genProfile(sess);
    const [coverLetter, personalStatement] = await Promise.all([
      generateCoverLetter(app.scholarship_title, app.organization, app.country, profile),
      generatePersonalStatement(app.scholarship_title, app.organization, app.country, app.field || profile.fieldOfStudy || "your field", profile),
    ]);

    const targetEmail = recipient_email || "scholarshipcommittee@example.com";
    const sent = await sendApplicationEmail(
      targetEmail,
      app.scholarship_title,
      app.organization,
      coverLetter,
      personalStatement,
      profile.fullName || sess.user.email,
    );

    if (sent) {
      await c.env.DB.prepare(`
        UPDATE applications SET status = 'applied', email_sent = 1, email_sent_at = CURRENT_TIMESTAMP, applied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(appId).run();

      // Save documents to DB
      await c.env.DB.prepare("INSERT INTO documents (user_id, application_id, scholarship_id, type, title, content) VALUES (1, ?, ?, 'cover_letter', ?, ?)")
        .bind(appId, app.scholarship_id, `Cover Letter - ${app.scholarship_title}`, coverLetter).run();
      await c.env.DB.prepare("INSERT INTO documents (user_id, application_id, scholarship_id, type, title, content) VALUES (1, ?, ?, 'personal_statement', ?, ?)")
        .bind(appId, app.scholarship_id, `Personal Statement - ${app.scholarship_title}`, personalStatement).run();

      // Notify user via email
      await sendNotificationToUser("application_sent", {
        scholarshipTitle: app.scholarship_title,
        organization: app.organization,
        sentTo: targetEmail,
        documents: ["Motivation Letter / Cover Letter", "Personal Statement"],
      });

      return c.json({ success: true, message: "Application sent successfully via email!" });
    } else {
      return c.json({ success: false, error: "Failed to send email" }, 500);
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get application stats
applications.get("/stats", async (c) => {
  try {
    const total = await c.env.DB.prepare("SELECT COUNT(*) as count FROM applications WHERE user_id = 1").first() as any;
    const applied = await c.env.DB.prepare("SELECT COUNT(*) as count FROM applications WHERE user_id = 1 AND status = 'applied'").first() as any;
    const pending = await c.env.DB.prepare("SELECT COUNT(*) as count FROM applications WHERE user_id = 1 AND status IN ('preparing', 'pending')").first() as any;
    const accepted = await c.env.DB.prepare("SELECT COUNT(*) as count FROM applications WHERE user_id = 1 AND status = 'accepted'").first() as any;
    const rejected = await c.env.DB.prepare("SELECT COUNT(*) as count FROM applications WHERE user_id = 1 AND status = 'rejected'").first() as any;

    return c.json({
      success: true,
      stats: {
        total: total?.count || 0,
        applied: applied?.count || 0,
        pending: pending?.count || 0,
        accepted: accepted?.count || 0,
        rejected: rejected?.count || 0,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default applications;
