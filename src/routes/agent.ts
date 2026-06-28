import { Hono } from "hono";
import { chatWithAgent } from "../lib/ai";
import { buildProfileSummary } from "../lib/profile";
import { sendEmail, notifyNewScholarship, notifyDeadlineReminder } from "../lib/email";
import { runScholarshipSearch } from "./scholarships";

type Bindings = { DB: D1Database };
const agent = new Hono<{ Bindings: Bindings }>();

// Chat with the AI agent
agent.post("/chat", async (c) => {
  try {
    const { message } = await c.req.json();
    if (!message) return c.json({ success: false, error: "Message is required" }, 400);

    // Get current context from DB
    const scholarshipCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM scholarships").first() as any;
    const applicationCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM applications WHERE user_id = 1").first() as any;
    const topScholarships = await c.env.DB.prepare("SELECT title, organization, country, match_score, deadline FROM scholarships ORDER BY match_score DESC LIMIT 3").all();
    const recentDocs = await c.env.DB.prepare("SELECT type, title, created_at FROM documents WHERE user_id = 1 ORDER BY created_at DESC LIMIT 3").all();

    const context = `
Current Database Status:
- Total scholarships found: ${scholarshipCount?.count || 0}
- Total applications started: ${applicationCount?.count || 0}
- Top 3 matched scholarships: ${JSON.stringify(topScholarships.results)}
- Recent documents generated: ${JSON.stringify(recentDocs.results)}
    `.trim();

    const profileSummary = buildProfileSummary();
    const response = await chatWithAgent(message, context, profileSummary);

    // Save to AI memory
    await c.env.DB.prepare("INSERT INTO ai_memory (type, key, value) VALUES ('chat', ?, ?)")
      .bind(message.substring(0, 100), response.substring(0, 500))
      .run();

    return c.json({ success: true, response, timestamp: new Date().toISOString() });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Auto-run the agent (full workflow)
agent.post("/run", async (c) => {
  try {
    const steps: string[] = [];

    // Step 1: Check how many scholarships we have
    const count = await c.env.DB.prepare("SELECT COUNT(*) as count FROM scholarships").first() as any;
    steps.push(`Current scholarships in database: ${count?.count || 0}`);

    // Step 2: Trigger a search (direct call — no fragile self-fetch)
    try {
      const { found, skippedExpired } = await runScholarshipSearch(c.env.DB, null);
      steps.push(`Search complete: found ${found.length} new scholarship${found.length === 1 ? "" : "s"}${skippedExpired ? `, skipped ${skippedExpired} expired` : ""}.`);
    } catch (e: any) {
      steps.push(`Search step failed: ${e?.message || "unknown error"} (check API keys in .dev.vars).`);
    }

    // Step 3: Get top unprocessed scholarships
    const topScholarships = await c.env.DB.prepare(
      "SELECT * FROM scholarships WHERE status = 'found' AND match_score >= 65 ORDER BY match_score DESC LIMIT 3"
    ).all();

    steps.push(`High-match scholarships ready for application: ${topScholarships.results.length}`);

    return c.json({
      success: true,
      message: "Agent run complete",
      steps,
      scholarships_ready: topScholarships.results.length,
      next_action: topScholarships.results.length > 0
        ? "Review top scholarships and start applications"
        : "Continue searching for more scholarships",
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get agent status/health
agent.get("/status", async (c) => {
  try {
    const scholarships = await c.env.DB.prepare("SELECT COUNT(*) as count FROM scholarships").first() as any;
    const applications = await c.env.DB.prepare("SELECT COUNT(*) as count FROM applications WHERE user_id = 1").first() as any;
    const documents = await c.env.DB.prepare("SELECT COUNT(*) as count FROM documents WHERE user_id = 1").first() as any;
    const highMatch = await c.env.DB.prepare("SELECT COUNT(*) as count FROM scholarships WHERE match_score >= 70").first() as any;
    const searches = await c.env.DB.prepare("SELECT COUNT(*) as count FROM search_history").first() as any;

    return c.json({
      success: true,
      status: "operational",
      ai_model: "Groq Llama 3.3 70B Versatile",
      search_engine: "Serper (Google)",
      web_reader: "Jina AI",
      email_service: "Resend (onboarding@resend.dev)",
      database: "Cloudflare D1 (SQLite)",
      current_date: "June 6, 2026",
      intake_year: "2026-2027",
      stats: {
        total_scholarships: scholarships?.count || 0,
        high_match_scholarships: highMatch?.count || 0,
        total_applications: applications?.count || 0,
        documents_generated: documents?.count || 0,
        total_searches: searches?.count || 0,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get notifications
agent.get("/notifications", async (c) => {
  try {
    const notifications = await c.env.DB.prepare(
      "SELECT * FROM notifications WHERE user_id = 1 ORDER BY created_at DESC LIMIT 20"
    ).all();
    return c.json({ success: true, notifications: notifications.results });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── TEST EMAIL ────────────────────────────────────────────────
// Sends a test email to ashmamali2002@gmail.com to verify Resend is working
agent.post("/test-email", async (c) => {
  try {
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="background:#0f172a;margin:0;padding:24px;font-family:Inter,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">

  <div style="background:linear-gradient(135deg,#1e40af,#0ea5e9);padding:28px 32px;">
    <p style="color:#bfdbfe;font-size:11px;margin:0 0 6px;letter-spacing:1.5px;text-transform:uppercase;">AI Scholarship Agent</p>
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">✅ Email System Confirmed Working!</h1>
    <p style="color:#bfdbfe;margin:8px 0 0;font-size:13px;">June 6, 2026 — System Verification Test</p>
  </div>

  <div style="padding:28px 32px;">
    <p style="color:#f1f5f9;font-size:15px;margin:0 0 20px;">
      Hello <strong>Syed Ashmam Ali Shah</strong>,
    </p>
    <p style="color:#cbd5e1;font-size:14px;line-height:1.7;margin:0 0 20px;">
      This is a test email from your <strong>AI Scholarship Agent</strong>. If you are reading this, 
      the Resend email integration is fully operational and working correctly. 
      You will now receive real-time notifications for:
    </p>

    <div style="background:#0f172a;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:20px;">🎓</span>
          <div>
            <p style="color:#f1f5f9;font-size:13px;font-weight:600;margin:0;">New Scholarship Matches</p>
            <p style="color:#64748b;font-size:12px;margin:2px 0 0;">When the AI finds scholarships with good match score for your profile</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:20px;">⏰</span>
          <div>
            <p style="color:#f1f5f9;font-size:13px;font-weight:600;margin:0;">Deadline Reminders</p>
            <p style="color:#64748b;font-size:12px;margin:2px 0 0;">Urgent alerts when scholarship deadlines are 7 days away</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:20px;">📨</span>
          <div>
            <p style="color:#f1f5f9;font-size:13px;font-weight:600;margin:0;">Application Confirmations</p>
            <p style="color:#64748b;font-size:12px;margin:2px 0 0;">When an application is successfully submitted to a scholarship committee</p>
          </div>
        </div>
      </div>
    </div>

    <div style="background:#1e3a1e;border:1px solid #166534;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="color:#4ade80;font-size:13px;font-weight:700;margin:0 0 8px;">📋 Your Agent Profile</p>
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <tr><td style="color:#64748b;padding:3px 0;width:130px;">Name</td><td style="color:#f1f5f9;font-weight:600;">Syed Ashmam Ali Shah</td></tr>
        <tr><td style="color:#64748b;padding:3px 0;">Email</td><td style="color:#f1f5f9;">ashmamali2002@gmail.com</td></tr>
        <tr><td style="color:#64748b;padding:3px 0;">Phone</td><td style="color:#f1f5f9;">+92 347 1978085</td></tr>
        <tr><td style="color:#64748b;padding:3px 0;">Address</td><td style="color:#f1f5f9;">Back Street of PMS Boys 3, Ring Road, Peshawar, Pakistan</td></tr>
        <tr><td style="color:#64748b;padding:3px 0;">Degree</td><td style="color:#f1f5f9;">BSc Biotechnology — CGPA 2.75/4.0</td></tr>
        <tr><td style="color:#64748b;padding:3px 0;">Publications</td><td style="color:#f1f5f9;">3 peer-reviewed papers ✓</td></tr>
        <tr><td style="color:#64748b;padding:3px 0;">AI Model</td><td style="color:#f1f5f9;">Groq Llama 3.3 70B Versatile</td></tr>
        <tr><td style="color:#64748b;padding:3px 0;">Searching for</td><td style="color:#f1f5f9;">2026-2027 Intake — Fully Funded</td></tr>
      </table>
    </div>

    <p style="color:#475569;font-size:12px;text-align:center;margin:0;border-top:1px solid #1e293b;padding-top:16px;">
      AI Scholarship Agent · Powered by Groq + Resend + Cloudflare<br>
      Syed Ashmam Ali Shah | ashmamali2002@gmail.com | +92 347 1978085
    </p>
  </div>

</div>
</body></html>`;

    const result = await sendEmail(
      "ashmamali2002@gmail.com",
      "✅ AI Scholarship Agent — Email Test Successful",
      html
    );

    if (result.success) {
      return c.json({
        success: true,
        message: "Test email sent successfully to ashmamali2002@gmail.com",
        email_id: result.id,
        sent_to: "ashmamali2002@gmail.com",
        from: "onboarding@resend.dev",
        note: "Check your Gmail inbox (also check Spam folder)",
      });
    } else {
      return c.json({
        success: false,
        error: result.error || "Email send failed",
        hint: "Resend API returned an error. Check the RESEND_API_KEY and FROM address.",
      }, 500);
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── NOTIFY: New scholarship alert ────────────────────────────
agent.post("/notify-scholarship", async (c) => {
  try {
    const body = await c.req.json() as any;
    const scholarship_id = body.scholarship_id;

    if (!scholarship_id) {
      // Send for top match if no ID given
      const top = await c.env.DB.prepare(
        "SELECT * FROM scholarships WHERE is_expired = 0 OR is_expired IS NULL ORDER BY match_score DESC LIMIT 1"
      ).first() as any;
      if (!top) return c.json({ success: false, error: "No scholarships found in database" }, 404);

      const ok = await notifyNewScholarship({
        title: top.title,
        organization: top.organization,
        country: top.country,
        deadline: top.deadline,
        matchScore: top.match_score,
        covers: top.covers || "Fully Funded",
        url: top.url,
      });
      return c.json({ success: ok, message: ok ? "Notification sent" : "Failed to send" });
    }

    const sch = await c.env.DB.prepare("SELECT * FROM scholarships WHERE id = ?").bind(scholarship_id).first() as any;
    if (!sch) return c.json({ success: false, error: "Scholarship not found" }, 404);

    const ok = await notifyNewScholarship({
      title: sch.title,
      organization: sch.organization,
      country: sch.country,
      deadline: sch.deadline,
      matchScore: sch.match_score,
      covers: sch.covers || "Fully Funded",
      url: sch.url,
    });
    return c.json({ success: ok, message: ok ? "Notification sent" : "Failed to send" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── NOTIFY: Deadline reminder ─────────────────────────────────
agent.post("/notify-deadline", async (c) => {
  try {
    const body = await c.req.json() as any;
    const scholarship_id = body.scholarship_id;
    const days_left = body.days_left || 7;

    const sch = scholarship_id
      ? await c.env.DB.prepare("SELECT * FROM scholarships WHERE id = ?").bind(scholarship_id).first() as any
      : await c.env.DB.prepare("SELECT * FROM scholarships WHERE is_expired = 0 ORDER BY match_score DESC LIMIT 1").first() as any;

    if (!sch) return c.json({ success: false, error: "No scholarship found" }, 404);

    const ok = await notifyDeadlineReminder({
      title: sch.title,
      deadline: sch.deadline || "Check website",
      daysLeft: days_left,
      url: sch.url,
    });
    return c.json({ success: ok, message: ok ? "Deadline reminder sent" : "Failed" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── FULL DATA EXPORT ─────────────────────────────────────────
// GET /api/agent/export?format=json|csv
agent.get("/export", async (c) => {
  try {
    const format = c.req.query("format") || "json";
    const section = c.req.query("section") || "all"; // scholarships|documents|professors|applications|all

    const [scholarships, documents, professors, applications, profile, publications, academicRecords] =
      await Promise.all([
        c.env.DB.prepare("SELECT id,title,organization,country,amount,deadline,covers,match_score,is_fully_funded,status,url,source_trust_level,source_domain,created_at FROM scholarships WHERE is_expired=0 OR is_expired IS NULL ORDER BY match_score DESC").all(),
        c.env.DB.prepare("SELECT id,type,title,content,created_at FROM documents WHERE user_id=1 ORDER BY created_at DESC").all(),
        c.env.DB.prepare("SELECT id,name,title,university,department,country,email,linkedin_url,profile_url,research_interests,lab_name,accepting_students,relevance_score FROM professors ORDER BY relevance_score DESC").all(),
        c.env.DB.prepare("SELECT a.*,s.title as scholarship_title,s.organization,s.country,s.deadline FROM applications a LEFT JOIN scholarships s ON a.scholarship_id=s.id WHERE a.user_id=1 ORDER BY a.created_at DESC").all(),
        c.env.DB.prepare("SELECT * FROM user_profile WHERE id=1").first(),
        c.env.DB.prepare("SELECT * FROM publications WHERE user_id=1 ORDER BY id").all(),
        c.env.DB.prepare("SELECT * FROM academic_records WHERE user_id=1 ORDER BY id").all(),
      ]);

    const payload: Record<string, any> = {
      exported_at: new Date().toISOString(),
      agent: "GETSCO v2.0",
      candidate: (profile as any)?.full_name || "Syed Ashmam Ali Shah",
    };

    if (section === "all" || section === "scholarships") payload.scholarships = scholarships.results;
    if (section === "all" || section === "documents") payload.documents = (documents.results as any[]).map(d => ({ ...d, content: d.content ? d.content.substring(0, 500) + (d.content.length > 500 ? "…" : "") : null }));
    if (section === "all" || section === "professors") payload.professors = professors.results;
    if (section === "all" || section === "applications") payload.applications = applications.results;
    if (section === "all" || section === "profile") {
      payload.profile = profile;
      payload.publications = publications.results;
      payload.academic_records = academicRecords.results;
    }

    if (format === "csv") {
      // Export scholarships as CSV
      const rows = (scholarships.results as any[]);
      if (!rows.length) return c.text("No data", 200);
      const headers = Object.keys(rows[0]).join(",");
      const lines = rows.map(r => Object.values(r).map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
      const csv = [headers, ...lines].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="getsco-scholarships-${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="getsco-export-${new Date().toISOString().slice(0,10)}.json"`,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── PREVIEW STATS ENDPOINT ────────────────────────────────────
agent.get("/preview-stats", async (c) => {
  try {
    const [schRow, profRow, docRow, appRow, topScholarships, topProfs, recentDocs] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN match_score>=70 THEN 1 ELSE 0 END) as high_match, SUM(CASE WHEN source_trust_level='official' THEN 1 ELSE 0 END) as official_count, SUM(CASE WHEN is_fully_funded=1 THEN 1 ELSE 0 END) as funded_count FROM scholarships WHERE is_expired=0 OR is_expired IS NULL").first(),
      c.env.DB.prepare("SELECT COUNT(*) as total FROM professors").first(),
      c.env.DB.prepare("SELECT COUNT(*) as total FROM documents WHERE user_id=1").first(),
      c.env.DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END) as accepted FROM applications WHERE user_id=1").first(),
      c.env.DB.prepare("SELECT id,title,organization,country,match_score,deadline,covers,is_fully_funded,source_trust_level,url FROM scholarships WHERE is_expired=0 ORDER BY match_score DESC LIMIT 10").all(),
      c.env.DB.prepare("SELECT id,name,title,university,email,research_interests,accepting_students,relevance_score FROM professors ORDER BY relevance_score DESC LIMIT 6").all(),
      c.env.DB.prepare("SELECT id,type,title,created_at FROM documents WHERE user_id=1 ORDER BY created_at DESC LIMIT 8").all(),
    ]);

    return c.json({
      success: true,
      stats: {
        scholarships: schRow,
        professors: profRow,
        documents: docRow,
        applications: appRow,
      },
      top_scholarships: topScholarships.results,
      top_professors: topProfs.results,
      recent_documents: recentDocs.results,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ── QUALITY / VERIFICATION METRICS ───────────────────────────
agent.get("/quality", async (c) => {
  try {
    const DB = c.env.DB;
    const [logTotals, byType, sch, prof, docs, recentFails] = await Promise.all([
      DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN result='pass' THEN 1 ELSE 0 END) as passes, SUM(CASE WHEN result='fail' THEN 1 ELSE 0 END) as fails FROM verification_log").first(),
      DB.prepare("SELECT entity_type, result, COUNT(*) as n FROM verification_log GROUP BY entity_type, result").all(),
      DB.prepare("SELECT SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END) as verified, SUM(CASE WHEN (verified=0 OR verified IS NULL) AND (is_expired=0 OR is_expired IS NULL) THEN 1 ELSE 0 END) as unverified, SUM(CASE WHEN is_expired=1 THEN 1 ELSE 0 END) as expired, SUM(CASE WHEN link_ok=0 THEN 1 ELSE 0 END) as dead_links FROM scholarships").first(),
      DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END) as verified, SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) as with_email FROM professors").first(),
      DB.prepare("SELECT COALESCE(SUM(references_total),0) as refs_total, COALESCE(SUM(references_verified),0) as refs_verified FROM documents").first(),
      DB.prepare("SELECT entity_type, entity_ref, check_name, reason, created_at FROM verification_log WHERE result='fail' ORDER BY id DESC LIMIT 10").all(),
    ]);

    // Compute a MEANINGFUL success rate from real per-unit data:
    //  - references: verified / total (Crossref)
    //  - professors: validation passes / (passes + fails)
    const bt = (byType as any).results || [];
    const getN = (t: string, r: string) => (bt.find((x: any) => x.entity_type === t && x.result === r)?.n) || 0;
    const profPass = getN("professor", "pass");
    const profFail = getN("professor", "fail");
    const refTotal = (docs as any)?.refs_total || 0;
    const refVerified = (docs as any)?.refs_verified || 0;

    const successUnits = refVerified + profPass;
    const totalUnits = refTotal + profPass + profFail;
    const successRate = totalUnits ? Math.round((successUnits / totalUnits) * 100) : 100;
    const invalid = (refTotal - refVerified) + profFail;

    return c.json({
      success: true,
      verification_success_rate: successRate,
      total_checks: totalUnits,
      invalid_records_detected: invalid,
      scholarships: sch,
      professors: prof,
      references: docs,
      professor_validation: { passed: profPass, rejected: profFail },
      by_type: bt,
      recent_failures: (recentFails as any).results,
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default agent;
