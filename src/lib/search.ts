// ============================================================
// GETSCO — Trusted Scholarship Search Engine
// Only fetches from verified government, HEC-recognised,
// and official university/embassy/ministry sources.
// Social media, YouTube, Facebook, blogs are blocked.
// ============================================================

// API keys loaded from Cloudflare Worker environment (set in .dev.vars / wrangler secrets)
// DO NOT hardcode secrets here
function getSerperKey(): string { return (globalThis as any).SERPER_API_KEY || ''; }
function getJinaKey(): string   { return (globalThis as any).JINA_API_KEY   || ''; }

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  trustLevel?: "official" | "recognised" | "unknown";
}

// ── Blocked domains — junk, social media, clickbait ─────────
const BLOCKED_DOMAINS = [
  "youtube.com", "youtu.be",
  "facebook.com", "fb.com", "instagram.com", "twitter.com", "x.com",
  "tiktok.com", "pinterest.com", "reddit.com", "quora.com",
  "medium.com", "blogspot.com", "wordpress.com",
  "scholarshipfellow.com", "scholarshipdb.net",
  "opportunitydesk.org", "scholars4dev.com",
  "opportunitiesforafricans.com",
  "hotcoursesabroad.com",
  "topuniversities.com",
];

// ── Tier-1 TRUSTED domains — official government/ministry/uni sources ──
const TRUSTED_TIER1_DOMAINS = [
  // Pakistan — HEC & government
  "hec.gov.pk", "mofa.gov.pk", "pc.gov.pk",
  // German — DAAD official
  "daad.de", "research-in-germany.org",
  // Japanese — MEXT official
  "studyinjapan.go.jp", "mext.go.jp", "jasso.or.jp",
  // Korean — NIIED official
  "niied.go.kr", "studyinkorea.go.kr",
  // Chinese — CSC official
  "campuschina.org", "csc.edu.cn",
  // Taiwan — MOE / ICDF official
  "icdf.org.tw", "studyintaiwan.org", "moe.gov.tw",
  // Australian government
  "australiaawards.gov.au", "dfat.gov.au",
  // US government / Fulbright
  "usefpakistan.org", "iie.org", "state.gov",
  // French — Campus France
  "campusfrance.org",
  // Swedish — SI official
  "si.se",
  // European Commission
  "eacea.ec.europa.eu", "ec.europa.eu", "erasmus-mundus.eu",
  // Islamic Development Bank
  "isdb.org",
  // Commonwealth Scholarship
  "cscuk.fcdo.gov.uk", "acu.ac.uk",
  // OPEC Fund
  "opec.org", "opecfund.org",
  // Kuwait Cultural Office Pakistan
  "kuwaitculture.org.pk",
  // UAE / Saudi / Qatar official
  "scholarship.gov.sa", "mohe.gov.sa",
  "uaescholarship.moe.gov.ae",
  // World Bank / UN / ADB
  "worldbank.org", "undp.org", "adb.org",
  // Gates, Wellcome, Bill & Melinda (major foundations)
  "gatesfoundation.org", "wellcome.org",
  // Aga Khan Foundation
  "akdn.org",
];

// ── Tier-2 RECOGNISED domains — reputable .edu, .ac, .org sources ──
const RECOGNISED_EXTENSIONS = [".edu", ".ac.uk", ".ac.jp", ".ac.kr", ".edu.pk", ".edu.au", ".edu.cn", ".gov"];

export function classifyUrl(url: string): { trusted: boolean; tier: "official" | "recognised" | "unknown"; domain: string } {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // Blocked?
    if (BLOCKED_DOMAINS.some(d => hostname.includes(d))) {
      return { trusted: false, tier: "unknown", domain: hostname };
    }

    // Tier 1 — official
    if (TRUSTED_TIER1_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d))) {
      return { trusted: true, tier: "official", domain: hostname };
    }

    // Tier 2 — recognised academic/gov extensions
    if (RECOGNISED_EXTENSIONS.some(ext => hostname.endsWith(ext))) {
      return { trusted: true, tier: "recognised", domain: hostname };
    }

    // Unknown — do not auto-block, but mark for AI review
    return { trusted: false, tier: "unknown", domain: hostname };
  } catch {
    return { trusted: false, tier: "unknown", domain: "" };
  }
}

// ── Core Serper search + trust filter ───────────────────────
export async function searchScholarships(query: string, numResults: number = 10): Promise<SearchResult[]> {
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": getSerperKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: numResults, gl: "us", hl: "en" }),
    });

    if (!response.ok) throw new Error(`Serper API error: ${response.status}`);

    const data = await response.json() as any;
    const results: SearchResult[] = [];

    if (data.organic) {
      for (const item of data.organic) {
        const url = item.link || "";
        if (!url) continue;

        const { trusted, tier } = classifyUrl(url);
        // Only keep official + recognised sources
        if (!trusted) continue;

        results.push({
          title: item.title || "",
          url,
          snippet: item.snippet || "",
          source: new URL(url).hostname,
          trustLevel: tier,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
}

// ── Read full page via Jina (only for trusted URLs) ─────────
export async function readWebpage(url: string): Promise<string> {
  const { trusted } = classifyUrl(url);
  if (!trusted) return "";

  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        "Authorization": `Bearer ${getJinaKey()}`,
        "Accept": "text/plain",
        "X-Return-Format": "text",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return "";
    const text = await response.text();
    return text.substring(0, 5000);
  } catch (error) {
    console.error("Jina read error:", error);
    return "";
  }
}

// ── Build OFFICIAL-SOURCE-ONLY search queries ────────────────
// All queries target site: restrictions on known trusted domains
export function buildSearchQueries(_profile: any): string[] {
  return [
    // HEC Pakistan — most trusted for Pakistani students
    'site:hec.gov.pk scholarship masters 2026 2027',
    // DAAD — Germany official
    'site:daad.de masters scholarship biotechnology 2026 Pakistan',
    // MEXT Japan
    'site:studyinjapan.go.jp OR site:mext.go.jp scholarship 2026 2027',
    // KGSP South Korea
    'site:niied.go.kr OR site:studyinkorea.go.kr scholarship 2026 Pakistan',
    // CSC China
    'site:campuschina.org scholarship 2026 2027 Pakistan biotechnology',
    // Erasmus Mundus EU
    'site:eacea.ec.europa.eu Erasmus Mundus scholarship biotechnology 2026 2027',
    // Australia Awards
    'site:australiaawards.gov.au OR site:dfat.gov.au scholarship Pakistan 2026',
    // Fulbright Pakistan
    'site:usefpakistan.org Fulbright scholarship 2026 masters',
    // IsDB scholarship
    'site:isdb.org scholarship Pakistan 2026 masters',
    // Commonwealth
    'site:cscuk.fcdo.gov.uk Commonwealth scholarship 2026 masters Pakistan',
    // France Eiffel
    'site:campusfrance.org Eiffel excellence scholarship 2026 Pakistan masters',
    // Sweden SI
    'site:si.se Swedish Institute scholarship 2026 Pakistan masters',
    // Gates / Wellcome Foundation
    'site:gatesfoundation.org OR site:wellcome.org scholarship 2026 masters biotechnology',
    // Aga Khan
    'site:akdn.org scholarship Pakistan masters 2026',
    // Taiwan ICDF
    'site:icdf.org.tw scholarship 2026 2027 masters Pakistan',
  ];
}

// ── Search professors in a specific university/department ────
export async function searchProfessors(university: string, department: string, country: string): Promise<SearchResult[]> {
  const queries = [
    `${university} ${department} faculty professors staff email site:${getDomainForUniversity(university)}`,
    `"${university}" "${department}" professor PhD supervisor biotechnology molecular biology 2024 2025`,
    `${university} ${department} research group principal investigator email`,
  ];

  const allResults: SearchResult[] = [];
  for (const q of queries.slice(0, 2)) {
    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": getSerperKey(), "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 8, gl: "us", hl: "en" }),
      });
      if (!response.ok) continue;
      const data = await response.json() as any;
      if (data.organic) {
        for (const item of data.organic) {
          const url = item.link || "";
          const { trusted } = classifyUrl(url);
          // For professor search, accept university .edu / .ac pages
          const isUniPage = url.includes(university.toLowerCase().replace(/\s+/g, "")) ||
            url.includes(".edu") || url.includes(".ac.");
          if (!trusted && !isUniPage) continue;
          allResults.push({
            title: item.title || "",
            url,
            snippet: item.snippet || "",
            source: url ? new URL(url).hostname : "",
            trustLevel: "recognised",
          });
        }
      }
    } catch {}
  }
  return allResults;
}

function getDomainForUniversity(university: string): string {
  const known: Record<string, string> = {
    "daad": "daad.de",
    "heidelberg": "uni-heidelberg.de",
    "tokyo": "u-tokyo.ac.jp",
    "kyoto": "kyoto-u.ac.jp",
    "seoul": "snu.ac.kr",
    "peking": "pku.edu.cn",
    "tsinghua": "tsinghua.edu.cn",
    "nus": "nus.edu.sg",
    "melbourne": "unimelb.edu.au",
    "sydney": "sydney.edu.au",
    "mit": "mit.edu",
    "harvard": "harvard.edu",
    "cambridge": "cam.ac.uk",
    "oxford": "ox.ac.uk",
  };
  const lower = university.toLowerCase();
  for (const [key, domain] of Object.entries(known)) {
    if (lower.includes(key)) return domain;
  }
  return "edu"; // generic fallback
}

// ── Known scholarship programs (all official URLs only) ──────
export function getKnownScholarships(): Array<{ name: string; url: string; country: string }> {
  return [
    { name: "HEC Overseas Scholarship Pakistan", url: "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/Scholarships.aspx", country: "Pakistan" },
    { name: "DAAD Germany Masters", url: "https://www.daad.de/en/study-and-research-in-germany/scholarships/", country: "Germany" },
    { name: "MEXT Japan Research Student", url: "https://www.studyinjapan.go.jp/en/smap-stopj-applications-research.html", country: "Japan" },
    { name: "KGSP South Korea GKS", url: "https://www.niied.go.kr/user/brd/noticeList.do?brdId=ENG_NOTICE", country: "South Korea" },
    { name: "CSC China Government Scholarship", url: "https://www.campuschina.org/scholarships/index.html", country: "China" },
    { name: "Taiwan ICDF International Scholarship", url: "https://www.icdf.org.tw/ct.asp?xItem=12505&ctNode=30316&mp=2", country: "Taiwan" },
    { name: "Australia Awards Scholarship", url: "https://www.australiaawards.gov.au/", country: "Australia" },
    { name: "Fulbright Pakistan (USEFP)", url: "https://www.usefpakistan.org/", country: "USA" },
    { name: "Eiffel Excellence France", url: "https://www.campusfrance.org/en/eiffel-scholarship-program-of-excellence", country: "France" },
    { name: "Swedish Institute Global Professionals", url: "https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals/", country: "Sweden" },
    { name: "IsDB Merit Scholarship", url: "https://www.isdb.org/scholarships", country: "International" },
    { name: "Commonwealth Masters Scholarship", url: "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/", country: "UK" },
    { name: "Erasmus Mundus Joint Masters", url: "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en", country: "Europe" },
    { name: "Aga Khan Foundation International", url: "https://www.akdn.org/our-agencies/aga-khan-foundation/international-scholarship-programme", country: "International" },
  ];
}
