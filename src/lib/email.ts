// ============================================
// Email Service — Resend
// Notifications → ashmamali2002@gmail.com
// ============================================

// API key loaded from Cloudflare Worker environment (set in .dev.vars / wrangler secrets)
// DO NOT hardcode secrets here
function getResendKey(): string { return (globalThis as any).RESEND_API_KEY || ''; }
// Resend free plan: "from" MUST be onboarding@resend.dev on sandbox
const FROM_EMAIL = "onboarding@resend.dev";
const FROM_NAME = "AI Scholarship Agent";
const USER_EMAIL = "ashmamali2002@gmail.com";
const USER_NAME = "Syed Ashmam Ali Shah";
const CURRENT_DATE = "June 6, 2026";

// ── Core send function ────────────────────────────────────────
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const body: any = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    };
    if (replyTo) body.reply_to = replyTo;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getResendKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error("Resend error:", JSON.stringify(data));
      return { success: false, error: data?.message || `HTTP ${response.status}` };
    }

    return { success: true, id: data.id };
  } catch (error: any) {
    console.error("Email send exception:", error);
    return { success: false, error: error.message };
  }
}

// ── New scholarship alert to Ashmam ──────────────────────────
export async function notifyNewScholarship(scholarship: {
  title: string;
  organization: string;
  country: string;
  deadline: string;
  matchScore: number;
  covers: string;
  url: string;
}): Promise<boolean> {
  const scoreColor = scholarship.matchScore >= 70 ? "#059669" :
    scholarship.matchScore >= 50 ? "#d97706" : "#6b7280";
  const scoreLabel = scholarship.matchScore >= 70 ? "Excellent Match" :
    scholarship.matchScore >= 50 ? "Good Match" : "Possible Match";

  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="background:#0f172a;margin:0;padding:20px;font-family:Inter,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
  
  <div style="background:linear-gradient(135deg,#1e40af,#0ea5e9);padding:28px 32px;">
    <p style="color:#bfdbfe;font-size:12px;margin:0 0 4px;letter-spacing:1px;">AI SCHOLARSHIP AGENT</p>
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">🎓 New Scholarship Match Found!</h1>
    <p style="color:#bfdbfe;margin:6px 0 0;font-size:13px;">${CURRENT_DATE} — Tailored for your profile</p>
  </div>

  <div style="padding:28px 32px;">
    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 6px;">${scholarship.title}</h2>
    <p style="color:#94a3b8;margin:0 0 20px;font-size:14px;">${scholarship.organization}</p>

    <div style="display:grid;gap:10px;margin-bottom:24px;">
      <div style="background:#0f172a;border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#94a3b8;font-size:13px;">Match Score</span>
        <span style="color:${scoreColor};font-weight:700;font-size:16px;">${scholarship.matchScore}% — ${scoreLabel}</span>
      </div>
      <div style="background:#0f172a;border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;">
        <span style="color:#94a3b8;font-size:13px;">Country</span>
        <span style="color:#f1f5f9;font-size:13px;font-weight:600;">${scholarship.country}</span>
      </div>
      <div style="background:#0f172a;border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;">
        <span style="color:#94a3b8;font-size:13px;">Deadline</span>
        <span style="color:#fbbf24;font-size:13px;font-weight:600;">${scholarship.deadline}</span>
      </div>
      <div style="background:#0f172a;border-radius:10px;padding:14px 16px;">
        <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;">Covers</p>
        <p style="color:#f1f5f9;font-size:13px;margin:0;">${scholarship.covers}</p>
      </div>
    </div>

    <a href="${scholarship.url}" style="display:block;background:linear-gradient(135deg,#2563eb,#0ea5e9);color:#ffffff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;font-size:15px;margin-bottom:16px;">
      View Scholarship Details →
    </a>
    
    <p style="color:#475569;font-size:12px;text-align:center;margin:0;">
      Your AI Scholarship Agent is working for you 24/7<br>
      ${USER_NAME} | ${USER_EMAIL}
    </p>
  </div>
</div>
</body></html>`;

  const result = await sendEmail(
    USER_EMAIL,
    `🎓 New Match: ${scholarship.title} — ${scholarship.matchScore}% fit`,
    html
  );
  return result.success;
}

// ── Application sent confirmation to Ashmam ──────────────────
export async function notifyApplicationSent(data: {
  scholarshipTitle: string;
  organization: string;
  sentTo: string;
  documents: string[];
}): Promise<boolean> {
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#0f172a;margin:0;padding:20px;font-family:Inter,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
  <div style="background:linear-gradient(135deg,#059669,#10b981);padding:28px 32px;">
    <h1 style="color:#fff;margin:0;font-size:22px;">✅ Application Submitted!</h1>
    <p style="color:#a7f3d0;margin:6px 0 0;font-size:13px;">${CURRENT_DATE}</p>
  </div>
  <div style="padding:28px 32px;">
    <h2 style="color:#f1f5f9;font-size:17px;margin:0 0 4px;">${data.scholarshipTitle}</h2>
    <p style="color:#94a3b8;font-size:14px;margin:0 0 20px;">${data.organization}</p>
    <div style="background:#0f172a;border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Documents Sent</p>
      ${data.documents.map(d => `<p style="color:#34d399;font-size:13px;margin:4px 0;">✓ ${d}</p>`).join("")}
    </div>
    <div style="background:#0f172a;border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">Sent to</p>
      <p style="color:#f1f5f9;font-size:14px;margin:0;">${data.sentTo}</p>
    </div>
    <p style="color:#475569;font-size:12px;text-align:center;">
      ${USER_NAME} | ${USER_EMAIL} | +92 347 1978085
    </p>
  </div>
</div>
</body></html>`;

  const result = await sendEmail(
    USER_EMAIL,
    `✅ Application Sent — ${data.scholarshipTitle}`,
    html
  );
  return result.success;
}

// ── Deadline reminder to Ashmam ───────────────────────────────
export async function notifyDeadlineReminder(data: {
  title: string;
  deadline: string;
  daysLeft: number;
  url: string;
}): Promise<boolean> {
  const urgency = data.daysLeft <= 7 ? "🚨 URGENT" : data.daysLeft <= 14 ? "⚠️ SOON" : "⏰ Upcoming";
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#0f172a;margin:0;padding:20px;font-family:Inter,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
  <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:28px 32px;">
    <h1 style="color:#fff;margin:0;font-size:22px;">${urgency} — Scholarship Deadline!</h1>
  </div>
  <div style="padding:28px 32px;">
    <h2 style="color:#f1f5f9;font-size:17px;margin:0 0 16px;">${data.title}</h2>
    <div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:10px;padding:16px;margin-bottom:20px;text-align:center;">
      <p style="color:#fca5a5;font-size:13px;margin:0 0 4px;">Deadline</p>
      <p style="color:#ef4444;font-size:24px;font-weight:700;margin:0;">${data.deadline}</p>
      <p style="color:#fca5a5;font-size:13px;margin:4px 0 0;">${data.daysLeft} days remaining</p>
    </div>
    <a href="${data.url}" style="display:block;background:#dc2626;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;margin-bottom:16px;">
      Apply Now →
    </a>
    <p style="color:#475569;font-size:12px;text-align:center;">${USER_NAME} | AI Scholarship Agent</p>
  </div>
</div>
</body></html>`;

  const result = await sendEmail(
    USER_EMAIL,
    `${urgency}: ${data.title} — ${data.daysLeft} days left`,
    html
  );
  return result.success;
}

// ── Full application email to scholarship committee ───────────
export async function sendApplicationEmail(
  scholarshipEmail: string,
  scholarshipTitle: string,
  organization: string,
  coverLetter: string,
  personalStatement: string,
  applicantName: string
): Promise<boolean> {
  const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;line-height:1.7;color:#333;max-width:850px;margin:0 auto;padding:24px;">
  
  <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px 32px;border-radius:12px;margin-bottom:32px;">
    <h1 style="color:#fff;margin:0;font-size:22px;">Scholarship Application</h1>
    <p style="color:#bfdbfe;margin:6px 0 0;">${scholarshipTitle} — ${organization}</p>
    <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">Date: ${CURRENT_DATE}</p>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:28px;margin-bottom:24px;">
    <h2 style="color:#1e3a5f;border-bottom:2px solid #2563eb;padding-bottom:10px;font-size:18px;">Motivation Letter / Cover Letter</h2>
    <div style="white-space:pre-line;font-size:14px;line-height:1.8;color:#374151;">${coverLetter}</div>
  </div>

  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:28px;margin-bottom:24px;">
    <h2 style="color:#1e3a5f;border-bottom:2px solid #2563eb;padding-bottom:10px;font-size:18px;">Personal Statement</h2>
    <div style="white-space:pre-line;font-size:14px;line-height:1.8;color:#374151;">${personalStatement}</div>
  </div>

  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:20px;margin-bottom:24px;">
    <h3 style="color:#0369a1;margin:0 0 12px;font-size:15px;">Applicant Contact Information</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:6px 0;color:#64748b;width:140px;">Full Name</td><td style="color:#0f172a;font-weight:600;">${applicantName}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="color:#0f172a;">ashmamali2002@gmail.com</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Phone</td><td style="color:#0f172a;">+92 347 1978085</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Address</td><td style="color:#0f172a;">Back Street of PMS Boys 3, Ring Road, Peshawar, Pakistan</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;">Nationality</td><td style="color:#0f172a;">Pakistani</td></tr>
    </table>
  </div>

  <p style="color:#94a3b8;font-size:12px;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px;">
    This application was prepared and submitted by the AI Scholarship Agent on behalf of ${applicantName} on ${CURRENT_DATE}.
  </p>
</body></html>`;

  const result = await sendEmail(
    scholarshipEmail,
    `Scholarship Application — ${scholarshipTitle} — ${applicantName}`,
    html,
    "ashmamali2002@gmail.com"
  );
  return result.success;
}

// ── Legacy wrapper (backward compat) ─────────────────────────
export async function sendNotificationToUser(
  type: "new_scholarship" | "deadline_reminder" | "application_sent" | "weekly_report",
  data: any
): Promise<boolean> {
  if (type === "new_scholarship") return notifyNewScholarship(data);
  if (type === "application_sent") return notifyApplicationSent(data);
  if (type === "deadline_reminder") return notifyDeadlineReminder(data);
  return false;
}
