// ============================================================
// GETSCO — Resilient HTTP helper
// Retries transient failures (network errors, 429, 5xx) with
// exponential backoff. Used by all external API calls (Groq,
// Serper, Jina, Resend) so a single hiccup doesn't break a request.
// ============================================================

export interface RetryOptions {
  retries?: number;      // number of RETRIES after the first attempt
  baseDelayMs?: number;  // backoff base
  timeoutMs?: number;    // per-attempt timeout
  label?: string;        // for logging
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {}
): Promise<Response> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 600;
  const timeout = opts.timeoutMs ?? 20000;
  const label = opts.label ?? "fetch";

  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
      if (RETRYABLE_STATUS.has(res.status) && attempt < retries) {
        console.warn(`[${label}] HTTP ${res.status}, retry ${attempt + 1}/${retries}`);
        await sleep(base * Math.pow(2, attempt));
        continue;
      }
      return res;
    } catch (err: any) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`[${label}] ${err?.name || "error"}, retry ${attempt + 1}/${retries}`);
        await sleep(base * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastErr ?? new Error(`${label} failed after ${retries + 1} attempts`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
