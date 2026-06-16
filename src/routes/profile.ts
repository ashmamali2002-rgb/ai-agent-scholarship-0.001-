import { Hono } from "hono";
import { USER_PROFILE, buildProfileSummary } from "../lib/profile";

type Bindings = { DB: D1Database };
const profile = new Hono<{ Bindings: Bindings }>();

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
