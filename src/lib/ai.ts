// ============================================================
// GETSCO — AI Engine (Groq Llama 3.3 70B)
// Human-quality document generation + professor intelligence
// ============================================================

import { fetchWithRetry } from "./http";
import { mapFieldToDepartments } from "./departments";

// API key is injected at runtime via Cloudflare Worker env bindings
// Set in .dev.vars for local dev, wrangler secret put for production
// DO NOT hardcode API keys here
function getGroqKey(): string {
  // Cloudflare Workers injects env vars into globalThis via .dev.vars / wrangler secrets
  return (globalThis as any).GROQ_API_KEY || '';
}
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const TODAY = "June 6, 2026";
const INTAKE_YEAR = "2026-2027";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callAI(messages: AIMessage[], maxTokens: number = 4000): Promise<string> {
  try {
    const response = await fetchWithRetry(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${getGroqKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.72,
        top_p: 0.92,
        frequency_penalty: 0.25,
        presence_penalty: 0.15,
      }),
    }, { label: "groq", retries: 2, timeoutMs: 60000 });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${err}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || "No response generated";
  } catch (error) {
    console.error("AI call failed:", error);
    throw error;
  }
}

// ── Build a real-facts block from ANY user's normalized profile ──
// Documents are generated from these facts only. Empty fields are omitted
// and the prompts instruct the model never to invent missing details.
function fmtLangTests(lt: any): string {
  if (!lt) return "";
  const parts: string[] = [];
  if (lt.ielts) parts.push(`IELTS ${lt.ielts}`);
  if (lt.toefl) parts.push(`TOEFL ${lt.toefl}`);
  if (lt.gre) parts.push(`GRE ${lt.gre}`);
  return parts.join(", ");
}
export function applicantFacts(p: any): string {
  const L: string[] = [];
  const add = (label: string, v: any) => { if (v !== undefined && v !== null && String(v).trim() !== "") L.push(`${label}: ${v}`); };
  add("Full Name", p.fullName);
  add("Email", p.email); add("Phone", p.phone); add("Address", p.address);
  add("Nationality", p.nationality); add("Country of Residence", p.countryOfResidence);
  add("Gender", p.gender);
  if (p.currentDegree || p.university) add("Current / Highest Degree", `${p.currentDegree || ""}${p.university ? " — " + p.university : ""}`);
  if (p.cgpa) add("CGPA", `${p.cgpa} / ${p.cgpaScale || "4.0"}`);
  add("Graduation Year", p.graduationYear);
  add("Field of Study", p.fieldOfStudy);
  add("Thesis", p.thesisTitle);
  add("Research Interests", p.researchInterests);
  add("Preferred Master's Fields", p.preferredMasterFields);
  const lt = fmtLangTests(p.languageTests); if (lt) add("Language / Standardised Tests", lt);
  add("Preferred Countries", p.preferredCountries);
  add("Career Goal", p.careerGoal);
  add("Financial Status", p.financialStatus);
  add("Family Background", p.familyBackground);
  if (p.academicRecords?.length) {
    L.push("Academic Records:");
    for (const a of p.academicRecords) L.push(`  - ${a.level || ""}: ${a.institution || ""}${a.field ? ` (${a.field})` : ""}${(a.marks_obtained || a.marks) ? ` — ${a.marks_obtained || a.marks}` : ""}`);
  }
  if (p.publications?.length) {
    L.push(`Publications (${p.publications.length}):`);
    for (const pub of p.publications) L.push(`  - "${pub.title || ""}"${pub.journal ? ` — ${pub.journal}` : ""}${pub.year ? ` (${pub.year})` : ""}${pub.url ? ` ${pub.url}` : ""}`);
  }
  return L.join("\n") || "(No profile details provided — ask the applicant to complete their profile.)";
}

const NO_INVENT = "CRITICAL: Use ONLY the applicant details provided. NEVER invent publications, research, experiences, awards, dates, or qualifications the applicant does not have. If a detail is missing, write around it gracefully — do not fabricate. Write in the applicant's authentic first-person voice.";

// ============================================================
// COVER LETTER — Human voice, zero AI smell, per-user facts
// ============================================================
export async function generateCoverLetter(
  scholarshipTitle: string,
  organization: string,
  country: string,
  profile: any
): Promise<string> {
  const facts = applicantFacts(profile);
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are a senior academic editor who helps international students craft scholarship motivation letters that sound unmistakably human. Rules:
1. Never use the word "passion" or "passionate".
2. Never open with "I am writing to..." or "My name is...".
3. Short paragraphs. One idea each. White space breathes.
4. Every claim must have a specific proof drawn from the applicant's real details.
5. Vary sentence length for rhythm.
6. One moment of genuine reflection builds trust.
7. The closing should feel like a door opening.
8. Write in the applicant's authentic voice — quietly confident, not boastful, not desperate.
9. 550–700 words. ${NO_INVENT}`,
    },
    {
      role: "user",
      content: `Write the complete motivation letter for this scholarship, grounded entirely in the applicant's real details.

SCHOLARSHIP: ${scholarshipTitle}
AWARDING BODY: ${organization}
COUNTRY: ${country}

APPLICANT DETAILS (use exactly; do not invent anything not listed):
${facts}

STRUCTURE (flowing prose, no section headers):
- Opening: a specific, concrete observation or moment that put them on this path (draw from their field/interests/background).
- Academic background: what they studied and demonstrated, using their real degree, university, and any research/publications listed. If a CGPA is modest, frame it honestly and move to strengths.
- Why this scholarship / institution / country: specific to ${organization} in ${country}.
- Career vision: a concrete picture built on their stated career goal.
- Financial need (only if relevant to their stated financial status): brief and dignified.
- Closing: forward-looking, memorable.

End with a signature block using the applicant's name and contact details from above.`,
    },
  ];
  return await callAI(messages, 4000);
}

// ============================================================
// PERSONAL STATEMENT — Narrative arc, not a CV in prose
// The reader should feel they know this person
// ============================================================
export async function generatePersonalStatement(
  scholarshipTitle: string,
  organization: string,
  country: string,
  field: string,
  profile: any
): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are a writer who has ghostwritten personal statements for candidates who won Rhodes, Gates Cambridge, and Chevening. Committees remember people, not achievements.

Technique:
— Open in a scene, not a declaration.
— Let the intellectual journey unfold selectively — only the turning points.
— Use specific, concrete detail drawn from the applicant's real background.
— If a CGPA is modest, do not apologise — one honest sentence, then move to strengths.
— If the applicant has publications or research, make the reader feel their weight; if they have none, build the narrative from their studies, interests, and goals instead.
— Show intellectual curiosity as a living thing — what questions drive them?
— The closing connects the personal to the universal.
— No bullet points, no headers. Flowing prose, first person.
— Length: 850–1000 words. ${NO_INVENT}`,
    },
    {
      role: "user",
      content: `Write the complete personal statement for this scholarship, grounded entirely in the applicant's real details.

TARGET: ${scholarshipTitle} at ${organization}, ${country}
FIELD: ${field}

APPLICANT DETAILS (use exactly; do not invent anything not listed):
${applicantFacts(profile)}

STRUCTURE (continuous prose, no headers):
- Opening scene: start in the middle of something real from their background — not "I have always been interested in...".
- Intellectual development (2 paragraphs): how they arrived at this field, what they studied and did (use their real degree, and their research/publications only if listed above), and what question now drives them.
- Context (1 paragraph): what their journey took — persistence and drive, framed positively, not as a hardship story.
- Where they are going (1–2 paragraphs): the ${field} programme at ${organization}, why this environment, what they want to research next, tied to their stated career goal.
- Why it matters beyond themselves (1 paragraph): the specific contribution they intend to make.
- Closing (1 paragraph): quiet confidence.`,
    },
  ];
  return await callAI(messages, 4000);
}

// ============================================================
// ACADEMIC CV — Clean, scannable, complete
// Looks like a human assembled it over years, not in 5 minutes
// ============================================================
export async function generateResume(
  scholarshipTitle: string,
  scholarshipField: string,
  profile: any
): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are creating an academic CV for a scholarship application. The CV must look like it was carefully maintained over years by a serious researcher — not auto-generated. Rules:
— Clear hierarchy: name at top, then contact block, then sections in order
— Use consistent date formatting: Month YYYY – Month YYYY
— Bullet points under experience: start each with an action verb (Designed, Analysed, Published, Presented)
— Publication citations: author, title in quotes, journal in italics (use asterisks *journal name* to indicate italics in plain text), year
— Skills section: grouped by category, not a flat list
— No Lorem Ipsum, no filler — every line is real
— Length: simulate 2 pages of content (~1800–2400 words of text)
— Do not use the phrase "References available upon request" on its own line — place it at the end under REFERENCES section`,
    },
    {
      role: "user",
      content: `Create the complete academic CV, using ONLY the applicant's real details below.

TARGET SCHOLARSHIP: ${scholarshipTitle}
FIELD: ${scholarshipField}

APPLICANT DETAILS (use exactly; include only sections that have data — do not invent):
${applicantFacts(profile)}

CV SECTIONS (in this order; OMIT any section that has no data — never fabricate to fill it):
1. Header — full name, then a contact line (email / phone / address / nationality).
2. Education — reverse chronological, from the academic records above (level, institution, field, marks or CGPA, years).
3. Research Publications — APA-style citations of ONLY the publications listed above. If none are listed, omit this section entirely.
4. Research Experience / Projects — only from their thesis, research interests, or listed publications.
5. Technical & Research Skills — grouped by category, appropriate to their stated field of study.
6. Languages — from their profile / language tests if available.
7. Achievements — only real ones inferable from the data above.
8. References — a single line: "Available upon request."

Clean and scannable. Do NOT invent coursework, tools, publications, awards, or experience the applicant's real details don't support.`,
    },
  ];
  return await callAI(messages, 4000);
}

// ============================================================
// RESEARCH PROPOSAL — Scientific rigour, real methodology
// Not a student essay — reads like a junior researcher's proposal
// ============================================================
export async function generateResearchProposal(
  scholarshipTitle: string,
  field: string,
  profile: any
): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are writing a Master's research proposal for a scholarship committee of senior academics. The proposal must demonstrate:
1. Command of current literature — mention real journals and real debates in the field.
2. A clear logical chain: context/problem → specific gap → proposed study → expected contribution.
3. Feasibility — methods achievable within 18–24 months with standard university resources.
4. Originality — a natural extension of the applicant's stated interests, not a replication.
5. No vague statements — every claim has a specific reference or explanation.
6. Scientific writing style — third person for background, first person for objectives and the applicant's own prior work.
7. REFERENCES — CRITICAL: Do NOT fabricate citations. Only list references you are confident are REAL, well-known published works. Every reference is automatically checked against the Crossref database and unverifiable ones are removed. Better 4 real references than 10 invented. Never invent DOIs, authors, years, or journals.
— Length: 1100–1400 words (excluding title and reference list).`,
    },
    {
      role: "user",
      content: `Write the complete Master's research proposal in ${field}, grounded in the applicant's real background.

SCHOLARSHIP: ${scholarshipTitle}
RESEARCH FIELD: ${field}

APPLICANT DETAILS (use exactly; build on their real background — never invent prior work, publications, or methods they don't have):
${applicantFacts(profile)}

PROPOSAL STRUCTURE (numbered section headers):
1. TITLE — a specific, scientifically accurate title for a Master's project in ${field} connected to the applicant's stated research interests (and prior work, if any).
2. ABSTRACT (150–200 words) — problem → gap → hypothesis → methods → expected outcomes.
3. INTRODUCTION & BACKGROUND (250–300 words) — field context, current understanding, the gap; 3–4 REAL references.
4. PROBLEM STATEMENT (100–120 words) — the precise knowledge gap and why it matters.
5. RESEARCH OBJECTIVES — one main objective + 4–5 specific objectives (measurable verbs).
6. RESEARCH QUESTIONS — 4, mapped to the objectives.
7. LITERATURE REVIEW (280–350 words) — recent key studies in ${field}, what they found/missed; 6–8 REAL references.
8. METHODOLOGY (300–380 words) — a credible phased plan (Months 1–6, 7–12, 13–18, 19–24) using methods appropriate to ${field}; note any ethical/data considerations.
9. EXPECTED OUTCOMES & DELIVERABLES — 3–4 measurable outcomes.
10. SIGNIFICANCE & IMPACT (100–120 words) — scientific and practical relevance, and how it advances the applicant's path.
11. REFERENCES — APA format. ${NO_INVENT} Only list references you are confident are REAL; each is checked against Crossref and unverifiable ones are removed.`,
    },
  ];
  return await callAI(messages, 4000);
}

// ============================================================
// PROFESSOR FINDER — Extract names, emails, research areas
// from university faculty pages
// ============================================================
export interface ProfessorRecord {
  name: string;
  title: string;
  email: string;
  linkedinUrl: string;
  profileUrl: string;
  researchInterests: string;
  labName: string;
  labWebsite: string;
  googleScholarUrl: string;
  recentPublications: string[];
  acceptingStudents: string;
  relevanceScore: number;
  matchedTopics: string[];
  matchedKeywords: string[];
  recommendationReason: string;
  rawBio: string;
}

export async function analyzeProfessorPage(
  pageContent: string,
  university: string,
  field: string,
  profileSummary: string
): Promise<ProfessorRecord[]> {
  const { departments, areas } = mapFieldToDepartments(field);

  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are an academic intelligence extractor with a strict accuracy policy. You extract REAL faculty data from official university pages.

ABSOLUTE RULES — accuracy over completeness:
- Only extract information that is EXPLICITLY present in the page text provided.
- NEVER invent or guess an email address. If no email is visible, return "".
- NEVER invent publications, research areas, lab names, or profile URLs. If absent, return "" or [].
- Do not output a person unless their NAME is clearly present as a faculty member/professor.
- Return ONLY valid JSON. No markdown, no backticks, no commentary.`,
    },
    {
      role: "user",
      content: `Extract faculty/professors from this official page for "${university}".
TARGET FIELD: ${field}  (relevant departments: ${departments.join(", ")})

PAGE CONTENT (only use what is here — do not add outside knowledge):
${pageContent.substring(0, 5000)}

APPLICANT PROFILE (for compatibility scoring):
${profileSummary}

For each professor explicitly present, score research compatibility 0-100 against the applicant's interests and this field's research areas: ${areas.join(", ")}.
Also identify which specific topics/keywords overlap between the professor's research and the applicant.

Return ONLY this JSON array (use "" or [] when info is NOT in the page — never fabricate):
[
  {
    "name": "Full Name (required, must be in page)",
    "title": "Professor / Associate Professor / Assistant Professor / Dr. or ''",
    "email": "exact email from page or ''",
    "linkedinUrl": "url if in page or ''",
    "profileUrl": "official profile url if in page or ''",
    "labWebsite": "lab/group website if in page or ''",
    "googleScholarUrl": "scholar.google url if in page or ''",
    "researchInterests": "comma-separated areas from page or ''",
    "labName": "lab/group name from page or ''",
    "recentPublications": ["paper title if in page", "..."],
    "acceptingStudents": "yes / no / unknown",
    "relevanceScore": 0-100,
    "matchedTopics": ["overlapping research topic", "..."],
    "matchedKeywords": ["keyword", "..."],
    "recommendationReason": "1 sentence: why this professor fits this applicant (based only on page evidence)",
    "rawBio": "1-2 sentence factual summary from the page"
  }
]
If no real professors are present, return: []`,
    },
  ];

  try {
    const result = await callAI(messages, 2500);
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p: any) => p && p.name && String(p.name).trim().length > 1 && String(p.name).toLowerCase() !== "unknown")
      .map((p: any) => ({
        name: String(p.name).trim(),
        title: p.title || "",
        email: p.email || "",
        linkedinUrl: p.linkedinUrl || "",
        profileUrl: p.profileUrl || "",
        labWebsite: p.labWebsite || "",
        googleScholarUrl: p.googleScholarUrl || "",
        researchInterests: p.researchInterests || "",
        labName: p.labName || "",
        recentPublications: Array.isArray(p.recentPublications) ? p.recentPublications.filter((x: any) => x).slice(0, 5) : [],
        acceptingStudents: p.acceptingStudents || "unknown",
        relevanceScore: Math.min(100, Math.max(0, parseInt(p.relevanceScore) || 40)),
        matchedTopics: Array.isArray(p.matchedTopics) ? p.matchedTopics.filter((x: any) => x).slice(0, 6) : [],
        matchedKeywords: Array.isArray(p.matchedKeywords) ? p.matchedKeywords.filter((x: any) => x).slice(0, 8) : [],
        recommendationReason: p.recommendationReason || "",
        rawBio: p.rawBio || "",
      }));
  } catch {
    return [];
  }
}

// ============================================================
// UNIVERSITY DEPARTMENT INTELLIGENCE
// ============================================================
export async function analyzeUniversityDepartment(
  pageContent: string,
  university: string,
  country: string,
  profileSummary: string
): Promise<{
  topResearchAreas: string[];
  recommendedField: string;
  programStrengths: string;
  bestFitReason: string;
  applicationTips: string;
}> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are a university intelligence analyst. Analyse department/faculty pages and return structured JSON insights for a Pakistani biotechnology scholarship applicant. Return ONLY valid JSON.`,
    },
    {
      role: "user",
      content: `Analyse this ${university} (${country}) department page for a Pakistani biotechnology student applying for Masters.

PAGE CONTENT: ${pageContent.substring(0, 3000)}

CANDIDATE: ${profileSummary}

Return ONLY this JSON (no markdown):
{
  "topResearchAreas": ["area1", "area2", "area3"],
  "recommendedField": "the best Master's specialisation for this candidate at this university",
  "programStrengths": "2-3 sentences on what makes this department strong for biotechnology/molecular biology",
  "bestFitReason": "1-2 sentences on why this candidate specifically fits this department",
  "applicationTips": "2-3 specific actionable tips for applying to this university from Pakistan"
}`,
    },
  ];

  try {
    const result = await callAI(messages, 800);
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      topResearchAreas: parsed.topResearchAreas || [],
      recommendedField: parsed.recommendedField || "",
      programStrengths: parsed.programStrengths || "",
      bestFitReason: parsed.bestFitReason || "",
      applicationTips: parsed.applicationTips || "",
    };
  } catch {
    return {
      topResearchAreas: [],
      recommendedField: "",
      programStrengths: "",
      bestFitReason: "",
      applicationTips: "",
    };
  }
}

// ============================================================
// SCHOLARSHIP SCORING
// ============================================================
export async function scoreScholarship(scholarshipData: string, profileSummary: string): Promise<number> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are a scholarship eligibility analyst. Score match 0-100 for a Pakistani biotechnology graduate (CGPA 2.75, 3 peer-reviewed publications, need-based, seeking fully funded Master's). Consider: field alignment, Pakistani eligibility, academic level match, GPA minimums, research experience, financial need. Return ONLY a single integer 0-100.`,
    },
    {
      role: "user",
      content: `SCHOLARSHIP:\n${scholarshipData}\n\nCANDIDATE:\n${profileSummary}\n\nReturn ONLY a number 0-100:`,
    },
  ];

  try {
    const result = await callAI(messages, 10);
    const score = parseInt(result.trim().replace(/[^0-9]/g, "").substring(0, 3));
    return isNaN(score) ? 50 : Math.min(100, Math.max(0, score));
  } catch {
    return 50;
  }
}

// ============================================================
// SCHOLARSHIP PAGE ANALYZER
// ============================================================
export async function analyzeScholarshipPage(content: string, profileSummary: string): Promise<{
  title: string;
  organization: string;
  deadline: string;
  amount: string;
  requirements: string;
  isFullyFunded: boolean;
  matchScore: number;
  covers: string;
  applicationEmail: string;
  country: string;
  isExpired: boolean;
}> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are a scholarship data extractor. Today is ${TODAY}. Extract scholarship details and return ONLY valid JSON. Check if deadline has passed before June 6, 2026. No markdown, no explanation, just JSON.`,
    },
    {
      role: "user",
      content: `Extract from this official scholarship page. Today is ${TODAY}.

CONTENT: ${content.substring(0, 3000)}
CANDIDATE: ${profileSummary}

Return ONLY this JSON (no markdown, no backticks):
{
  "title": "official scholarship name",
  "organization": "awarding body",
  "deadline": "deadline date or month/year or Check official website",
  "amount": "funding amount or Fully Funded",
  "requirements": "key eligibility requirements in 1-2 sentences",
  "isFullyFunded": true or false,
  "matchScore": 0-100,
  "covers": "tuition/stipend/accommodation/insurance etc",
  "applicationEmail": "email address or empty string",
  "country": "host country name",
  "isExpired": true if deadline already passed before June 6 2026 else false
}`,
    },
  ];

  try {
    const result = await callAI(messages, 600);
    const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title || "Unknown Scholarship",
      organization: parsed.organization || "Unknown",
      deadline: parsed.deadline || "Check official website",
      amount: parsed.amount || "Unknown",
      requirements: parsed.requirements || "See official website",
      isFullyFunded: !!parsed.isFullyFunded,
      matchScore: Math.min(100, Math.max(0, parseInt(parsed.matchScore) || 50)),
      covers: parsed.covers || "Unknown",
      applicationEmail: parsed.applicationEmail || "",
      country: parsed.country || "International",
      isExpired: !!parsed.isExpired,
    };
  } catch {
    return {
      title: "Unknown Scholarship",
      organization: "Unknown",
      deadline: "Check official website",
      amount: "Unknown",
      requirements: "Check official website for details",
      isFullyFunded: false,
      matchScore: 50,
      covers: "Unknown",
      applicationEmail: "",
      country: "International",
      isExpired: false,
    };
  }
}

// ============================================================
// AI CHAT AGENT — GETSCO
// ============================================================
export async function chatWithAgent(userMessage: string, context: string, profileSummary: string): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are GETSCO — an intelligent scholarship guidance system built specifically for Syed Ashmam Ali Shah, a 23-year-old Pakistani biotechnology researcher from Peshawar. He has published 3 peer-reviewed papers, holds a CGPA of 2.75, and is seeking fully funded Master's scholarships. Today: ${TODAY}. Focus on scholarships with deadlines AFTER June 6, 2026 and 2026-2027 intakes only.

Your role: Provide expert, specific, actionable scholarship strategy. Only recommend scholarships from official government, HEC-recognised, university, and embassy sources. Never recommend anything sourced from social media, YouTube, or unverified blogs.

CANDIDATE PROFILE: ${profileSummary}
CURRENT DATABASE: ${context}`,
    },
    { role: "user", content: userMessage },
  ];
  return await callAI(messages, 1500);
}
