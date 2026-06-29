// ============================================================
// GETSCO — Authentication routes (Supabase GoTrue)
// Sessions are stored in HttpOnly cookies so the browser JS
// never touches the tokens directly.
// ============================================================

import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { signUp, signIn, signOut, resetPasswordRequest, getUser, refreshSession, supabaseConfigured } from "../lib/supabase";

type Bindings = { DB: D1Database };
const auth = new Hono<{ Bindings: Bindings }>();

const ACCESS = "sb-access-token";
const REFRESH = "sb-refresh-token";

function cookieOpts(c: any, maxAgeSec?: number) {
  const isHttps = new URL(c.req.url).protocol === "https:";
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: "Lax" as const,
    path: "/",
    ...(maxAgeSec ? { maxAge: maxAgeSec } : {}),
  };
}

function setSession(c: any, session: any, remember: boolean) {
  if (!session?.access_token) return;
  // Remember Me -> persistent (30 days); otherwise session cookie
  const maxAge = remember ? 60 * 60 * 24 * 30 : undefined;
  setCookie(c, ACCESS, session.access_token, cookieOpts(c, maxAge));
  if (session.refresh_token) setCookie(c, REFRESH, session.refresh_token, cookieOpts(c, 60 * 60 * 24 * 30));
}

// ── Helper used by other routes: who is the current user? ────
export async function currentUser(c: any): Promise<{ user: any; accessToken: string } | null> {
  let token = getCookie(c, ACCESS);
  if (token) {
    const user = await getUser(token);
    if (user) return { user, accessToken: token };
  }
  // Try refresh
  const refresh = getCookie(c, REFRESH);
  if (refresh) {
    try {
      const session = await refreshSession(refresh);
      if (session?.access_token) {
        setSession(c, session, true);
        const user = await getUser(session.access_token);
        if (user) return { user, accessToken: session.access_token };
      }
    } catch { /* fall through */ }
  }
  return null;
}

// ── Signup ───────────────────────────────────────────────────
auth.post("/signup", async (c) => {
  if (!supabaseConfigured()) return c.json({ success: false, error: "Auth not configured" }, 500);
  try {
    const { email, password, full_name } = await c.req.json();
    if (!email || !password) return c.json({ success: false, error: "Email and password are required" }, 400);
    if (password.length < 6) return c.json({ success: false, error: "Password must be at least 6 characters" }, 400);

    const redirectTo = new URL(c.req.url).origin + "/login";
    const result = await signUp(email, password, full_name || "", redirectTo);

    // If email confirmation is OFF, Supabase returns a session immediately.
    if (result?.access_token) {
      setSession(c, result, false);
      return c.json({ success: true, verified: true, message: "Account created. You are signed in." });
    }
    return c.json({
      success: true,
      verified: false,
      message: "Account created. Please check your email to verify your address, then log in.",
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400);
  }
});

// ── Login ────────────────────────────────────────────────────
auth.post("/login", async (c) => {
  if (!supabaseConfigured()) return c.json({ success: false, error: "Auth not configured" }, 500);
  try {
    const { email, password, remember } = await c.req.json();
    if (!email || !password) return c.json({ success: false, error: "Email and password are required" }, 400);
    const session = await signIn(email, password);
    setSession(c, session, !!remember);
    return c.json({ success: true, user: { id: session.user?.id, email: session.user?.email } });
  } catch (e: any) {
    const msg = /invalid login/i.test(e.message) ? "Incorrect email or password." :
      /not confirmed/i.test(e.message) ? "Please verify your email first (check your inbox)." : e.message;
    return c.json({ success: false, error: msg }, 401);
  }
});

// ── Logout ───────────────────────────────────────────────────
auth.post("/logout", async (c) => {
  const token = getCookie(c, ACCESS);
  if (token) await signOut(token);
  deleteCookie(c, ACCESS, { path: "/" });
  deleteCookie(c, REFRESH, { path: "/" });
  return c.json({ success: true });
});

// ── Password reset request ───────────────────────────────────
auth.post("/reset", async (c) => {
  if (!supabaseConfigured()) return c.json({ success: false, error: "Auth not configured" }, 500);
  try {
    const { email } = await c.req.json();
    if (!email) return c.json({ success: false, error: "Email is required" }, 400);
    const redirectTo = new URL(c.req.url).origin + "/login";
    await resetPasswordRequest(email, redirectTo);
    return c.json({ success: true, message: "If that email exists, a password reset link has been sent." });
  } catch (e: any) {
    // Don't reveal whether the email exists
    return c.json({ success: true, message: "If that email exists, a password reset link has been sent." });
  }
});

// ── Who am I? ────────────────────────────────────────────────
auth.get("/me", async (c) => {
  const session = await currentUser(c);
  if (!session) return c.json({ success: false, authenticated: false }, 401);
  return c.json({
    success: true,
    authenticated: true,
    user: { id: session.user.id, email: session.user.email, full_name: session.user.user_metadata?.full_name || "" },
  });
});

export default auth;
