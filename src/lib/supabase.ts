// ============================================================
// GETSCO — Supabase client (REST/fetch based, Workers-friendly)
// Auth (GoTrue) + Database (PostgREST with the user's JWT so
// Row-Level Security enforces per-user data isolation).
// No service_role key required for normal user operations.
// ============================================================

import { fetchWithRetry } from "./http";

function cfg() {
  return {
    url: ((globalThis as any).SUPABASE_URL || "").replace(/\/+$/, ""),
    anon: (globalThis as any).SUPABASE_ANON_KEY || "",
    service: (globalThis as any).SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

export function supabaseConfigured(): boolean {
  const c = cfg();
  return !!(c.url && c.anon);
}

// ── Auth (GoTrue) ────────────────────────────────────────────
async function authFetch(path: string, init: RequestInit): Promise<any> {
  const c = cfg();
  const res = await fetchWithRetry(`${c.url}/auth/v1/${path}`, {
    ...init,
    headers: { apikey: c.anon, "Content-Type": "application/json", ...(init.headers || {}) },
  }, { label: "supabase-auth", retries: 1, timeoutMs: 15000 });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.msg || (data as any)?.error_description || (data as any)?.error || `Auth error ${res.status}`);
  }
  return data;
}

export async function signUp(email: string, password: string, fullName = "", redirectTo?: string) {
  return authFetch("signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: { full_name: fullName },
      ...(redirectTo ? { options: { email_redirect_to: redirectTo } } : {}),
    }),
  });
}

export async function signIn(email: string, password: string) {
  return authFetch("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function refreshSession(refreshToken: string) {
  return authFetch("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function signOut(accessToken: string) {
  const c = cfg();
  await fetchWithRetry(`${c.url}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: c.anon, Authorization: `Bearer ${accessToken}` },
  }, { label: "supabase-logout", retries: 0, timeoutMs: 10000 }).catch(() => {});
  return { success: true };
}

export async function resetPasswordRequest(email: string, redirectTo?: string) {
  return authFetch("recover", {
    method: "POST",
    body: JSON.stringify({ email, ...(redirectTo ? { options: { redirect_to: redirectTo } } : {}) }),
  });
}

// Returns the authenticated user for a given access token, or null.
export async function getUser(accessToken: string): Promise<any | null> {
  if (!accessToken) return null;
  const c = cfg();
  try {
    const res = await fetchWithRetry(`${c.url}/auth/v1/user`, {
      headers: { apikey: c.anon, Authorization: `Bearer ${accessToken}` },
    }, { label: "supabase-user", retries: 1, timeoutMs: 12000 });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Database (PostgREST) — runs AS THE USER (RLS enforced) ───
// Pass the user's access token; RLS guarantees they only see their rows.
export interface RestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: any;
  accessToken: string;
  query?: string;          // e.g. "select=*&order=created_at.desc"
  prefer?: string;         // e.g. "return=representation"
}

export async function supaRest(table: string, opts: RestOptions): Promise<any> {
  const c = cfg();
  const q = opts.query ? `?${opts.query}` : "";
  const headers: Record<string, string> = {
    apikey: c.anon,
    Authorization: `Bearer ${opts.accessToken}`,
    "Content-Type": "application/json",
  };
  if (opts.prefer) headers["Prefer"] = opts.prefer;
  const res = await fetchWithRetry(`${c.url}/rest/v1/${table}${q}`, {
    method: opts.method || "GET",
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  }, { label: "supabase-rest", retries: 1, timeoutMs: 15000 });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error((data as any)?.message || (data as any)?.hint || `DB error ${res.status}`);
  }
  return data;
}
