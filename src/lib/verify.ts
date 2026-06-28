// ============================================================
// GETSCO — Verification Layer
// Real, traceable checks. Never fabricates: if something cannot
// be confirmed it is rejected or labelled, never invented.
// ============================================================

import { fetchWithRetry } from "./http";

// ── Verification audit logging ───────────────────────────────
export async function logVerification(
  DB: D1Database,
  entityType: string,
  entityRef: string,
  checkName: string,
  result: "pass" | "fail",
  reason = ""
): Promise<void> {
  try {
    await DB.prepare(
      "INSERT INTO verification_log (entity_type, entity_ref, check_name, result, reason) VALUES (?, ?, ?, ?, ?)"
    ).bind(entityType, (entityRef || "").substring(0, 200), checkName, result, reason.substring(0, 200)).run();
  } catch { /* logging must never break the request */ }
}

const CROSSREF = "https://api.crossref.org/works";
const UA = "GETSCO/1.0 (scholarship assistant; mailto:ybusiness257@gmail.com)";

// ── Country inference from an official domain ────────────────
// Used to validate that a university/professor's country claim is
// consistent with their official web domain. Returns "" if unsure.
const TLD_COUNTRY: Record<string, string> = {
  "pk": "Pakistan", "de": "Germany", "jp": "Japan", "kr": "South Korea",
  "cn": "China", "tw": "Taiwan", "au": "Australia", "uk": "United Kingdom",
  "fr": "France", "se": "Sweden", "sa": "Saudi Arabia", "ae": "United Arab Emirates",
  "qa": "Qatar", "kw": "Kuwait", "ca": "Canada", "us": "United States",
  "nl": "Netherlands", "ch": "Switzerland", "it": "Italy", "es": "Spain",
  "sg": "Singapore", "hk": "Hong Kong", "nz": "New Zealand", "in": "India",
  "za": "South Africa", "be": "Belgium", "at": "Austria", "dk": "Denmark",
  "fi": "Finland", "no": "Norway", "ie": "Ireland",
};

export function countryFromDomain(domain: string): string {
  if (!domain) return "";
  const host = domain.toLowerCase();
  if (host.endsWith(".edu") || host.endsWith(".gov")) return "United States";
  const parts = host.split(".");
  const tld = parts[parts.length - 1];
  // handle .ac.uk, .edu.pk, .ac.jp style
  const sld = parts.length >= 2 ? parts[parts.length - 1] : "";
  return TLD_COUNTRY[tld] || TLD_COUNTRY[sld] || "";
}

// Third-party aggregators / social — never treated as an official source.
const NON_OFFICIAL = [
  "researchgate.net", "academia.edu", "wikipedia.org", "linkedin.com",
  "scholar.google", "semanticscholar.org", "scopus.com", "orcid.org",
  "mendeley.com", "twitter.com", "x.com", "facebook.com", "youtube.com",
  "google.com", "bing.com",
];

// ── Is a hostname an official/academic source? ───────────────
// Accepts real institutional domains worldwide (incl. country-code TLDs
// like ki.se, utoronto.ca, ethz.ch) but rejects aggregators/social.
export function isOfficialAcademicDomain(domain: string): boolean {
  if (!domain) return false;
  const h = domain.toLowerCase();
  if (NON_OFFICIAL.some(a => h.includes(a))) return false;
  if (/\.(edu|ac|gov)(\.|$)/.test(h)) return true;
  if (h.includes("uni-") || h.includes("univ") || h.includes("university") || h.includes("hochschule") || h.includes("institut")) return true;
  // A non-aggregator domain on a national TLD, reached via a university-scoped
  // search, is treated as a plausible official institutional source.
  return !!countryFromDomain(h);
}

// ── Does a person's name actually appear in the source text? ──
export function nameInSource(name: string, sourceText: string): boolean {
  if (!name || !sourceText) return false;
  const txt = sourceText.toLowerCase();
  const parts = name.toLowerCase().replace(/\b(dr|prof|professor|mr|mrs|ms)\.?\b/g, "").trim().split(/\s+/).filter(p => p.length > 1);
  if (parts.length < 2) return false;
  // require the surname AND at least one more name token present
  const surname = parts[parts.length - 1];
  const others = parts.slice(0, -1);
  return txt.includes(surname) && others.some(o => txt.includes(o));
}

// ── Is a URL reachable? (link verification) ──────────────────
export async function verifyUrlReachable(url: string): Promise<boolean> {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  const headers = { "User-Agent": "Mozilla/5.0 (compatible; GETSCO-LinkCheck/1.0)" };
  try {
    const res = await fetchWithRetry(url, { method: "GET", redirect: "follow", headers }, { label: "linkcheck", retries: 0, timeoutMs: 10000 });
    // A live server is "reachable" even if it blocks bots (401/403/405) or
    // errors transiently (5xx). Only a missing page (404/410) is a dead link.
    return res.status !== 404 && res.status !== 410;
  } catch {
    return false;
  }
}

// ── Reference verification via Crossref ──────────────────────
export interface VerifiedReference {
  verified: boolean;
  citation: string;   // canonical citation if verified, else the disclaimer
  doi?: string;
}

function tokens(s: string): Set<string> {
  return new Set((s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3));
}
function overlap(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit++;
  return hit / tb.size; // fraction of the Crossref title found in the reference line
}

// Verify a single reference line against Crossref. Returns a verified
// canonical citation, or a "could not be verified" marker.
export async function verifyReference(refLine: string): Promise<VerifiedReference> {
  const clean = refLine.replace(/^\s*\[?\d+\]?[.)]\s*/, "").trim();
  if (clean.length < 12) return { verified: false, citation: "Reference could not be verified." };
  try {
    const url = `${CROSSREF}?query.bibliographic=${encodeURIComponent(clean)}&rows=1&select=title,author,issued,container-title,DOI,URL`;
    const res = await fetchWithRetry(url, { headers: { "User-Agent": UA, "Accept": "application/json" } }, { label: "crossref", retries: 1, timeoutMs: 12000 });
    if (!res.ok) return { verified: false, citation: "Reference could not be verified." };
    const data = await res.json() as any;
    const item = data?.message?.items?.[0];
    if (!item || !item.title?.[0]) return { verified: false, citation: "Reference could not be verified." };

    const crTitle = item.title[0];
    // Require the real title to substantially appear in the AI's reference line.
    if (overlap(clean, crTitle) < 0.6) return { verified: false, citation: "Reference could not be verified." };

    const authors = Array.isArray(item.author)
      ? item.author.slice(0, 4).map((a: any) => `${a.family || ""}${a.given ? ", " + a.given[0] + "." : ""}`).filter(Boolean).join(", ")
      : "";
    const year = item.issued?.["date-parts"]?.[0]?.[0] || "";
    const journal = Array.isArray(item["container-title"]) ? item["container-title"][0] : "";
    const doi = item.DOI || "";
    const link = doi ? `https://doi.org/${doi}` : (item.URL || "");

    const citation = `${authors}${year ? ` (${year})` : ""}. ${crTitle}.${journal ? ` ${journal}.` : ""}${link ? ` ${link}` : ""}`.trim();
    return { verified: true, citation, doi };
  } catch {
    return { verified: false, citation: "Reference could not be verified." };
  }
}

// Find a References section in a generated document and verify each entry.
// Returns { content, total, verified, unverified } — content has the
// references section rewritten with verified citations / disclaimers.
export async function verifyDocumentReferences(content: string): Promise<{ content: string; total: number; verified: number; unverified: number }> {
  if (!content) return { content, total: 0, verified: 0, unverified: 0 };

  // Locate the LAST references header (the real list is at the end of the doc;
  // earlier mentions of "references" in prose must be ignored).
  const re = /(^|\n)\s*(\d+\.?\s*)?(references|bibliography|works cited)\s*:?\s*\n/gi;
  let last: RegExpExecArray | null = null;
  for (let mm = re.exec(content); mm; mm = re.exec(content)) last = mm;
  if (!last || last.index === undefined) return { content, total: 0, verified: 0, unverified: 0 };
  const m = last;

  const headEnd = m.index + m[0].length;
  const head = content.slice(0, headEnd);
  const refsBlock = content.slice(headEnd);

  // Split into individual reference lines (numbered or blank-line separated)
  const rawLines = refsBlock.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
  if (!rawLines.length) return { content, total: 0, verified: 0, unverified: 0 };

  const toCheck = rawLines.slice(0, 14); // bound work
  const tail = rawLines.slice(14);

  const results = await Promise.all(toCheck.map(line => verifyReference(line)));
  let verified = 0, unverified = 0;
  const rebuilt = results.map((r, i) => {
    if (r.verified) { verified++; return `${i + 1}. ${r.citation}`; }
    unverified++;
    return `${i + 1}. Reference could not be verified.`;
  });
  // keep any overflow lines untouched but flagged
  for (const t of tail) rebuilt.push(`- ${t} (not verified)`);

  const note = `\n\n[Note: References automatically checked against the Crossref scholarly database. ${verified} of ${toCheck.length} verified; unverified entries are marked.]\n`;
  return {
    content: head + rebuilt.join("\n") + note,
    total: toCheck.length,
    verified,
    unverified,
  };
}
