import { Hono } from "hono";
import { USER_PROFILE, buildProfileSummary } from "../lib/profile";
import { currentUser } from "./auth";
import { supaRest } from "../lib/supabase";

type Bindings = { DB: D1Database };
const profile = new Hono<{ Bindings: Bindings }>();

// Editable profile columns (everything except system fields)
const PROFILE_FIELDS = [
  "full_name", "gender", "date_of_birth", "nationality", "country_of_residence",
  "city", "passport_number", "passport_expiry", "phone", "address",
  "current_degree", "university", "cgpa", "cgpa_scale", "graduation_year",
  "field_of_study", "thesis_title", "research_interests", "preferred_master_fields",
  "language_tests", "preferred_countries", "funding_type", "degree_level",
  "research_areas", "career_goal", "financial_status", "family_background",
];

// Fields that count toward "profile completion"
const COMPLETION_FIELDS = [
  "full_name", "nationality", "country_of_residence", "current_degree", "university",
  "cgpa", "field_of_study", "research_interests", "preferred_countries", "career_goal",
];

function calcCompletion(p: any): number {
  if (!p) return 0;
  const filled = COMPLETION_FIELDS.filter(f => {
    const v = p[f];
    return v !== null && v !== undefined && String(v).trim() !== "";
  }).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}

// ── Current user's profile (Supabase, per-user) ──────────────
profile.get("/me", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const rows = await supaRest("profiles", { accessToken: sess.accessToken, query: "select=*" });
    const p = (rows && rows[0]) || {};
    return c.json({ success: true, profile: p, completion: calcCompletion(p), email: sess.user.email });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ── Update current user's profile ────────────────────────────
profile.patch("/me", async (c) => {
  const sess = await currentUser(c);
  if (!sess) return c.json({ success: false, authenticated: false }, 401);
  try {
    const body = await c.req.json();
    const update: Record<string, any> = {};
    for (const f of PROFILE_FIELDS) if (f in body) update[f] = body[f] === "" ? null : body[f];

    // Merge with current to compute completion
    const cur = (await supaRest("profiles", { accessToken: sess.accessToken, query: "select=*" }))?.[0] || {};
    update.profile_completion = calcCompletion({ ...cur, ...update });
    update.updated_at = new Date().toISOString();

    const res = await supaRest("profiles", {
      method: "PATCH",
      accessToken: sess.accessToken,
      query: `id=eq.${sess.user.id}`,
      body: update,
      prefer: "return=representation",
    });
    const p = (res && res[0]) || {};
    return c.json({ success: true, profile: p, completion: calcCompletion(p) });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Get full profile
profile.get("/data", async (c) => {
  try {
    const user = await c.env.DB.prepare("SELECT * FROM user_profile WHERE id = 1").first();
    const academics = await c.env.DB.prepare("SELECT * FROM academic_records WHERE user_id = 1").all();
    const pubs = await c.env.DB.prepare("SELECT * FROM publications WHERE user_id = 1").all();
    const countries = await c.env.DB.prepare("SELECT * FROM target_countries WHERE user_id = 1 ORDER BY priority").all();
    const fields = await c.env.DB.prepare("SELECT * FROM preferred_fields WHERE user_id = 1 ORDER BY priority").all();

    return c.json({
      success: true,
      profile: user,
      academic_records: academics.results,
      publications: pubs.results,
      target_countries: countries.results,
      preferred_fields: fields.results,
      summary: buildProfileSummary(),
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Get profile summary for AI
profile.get("/summary", (c) => {
  return c.json({ success: true, summary: buildProfileSummary(), profile: USER_PROFILE });
});

// Update user email
profile.put("/email", async (c) => {
  try {
    const { email } = await c.req.json();
    await c.env.DB.prepare("UPDATE user_profile SET email = ? WHERE id = 1").bind(email).run();
    return c.json({ success: true, message: "Email updated" });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default profile;
