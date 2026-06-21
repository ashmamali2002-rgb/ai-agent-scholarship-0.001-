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

// ============================================================
// COVER LETTER — Human voice, zero AI smell
// Warm, specific, personal, never templated
// ============================================================
export async function generateCoverLetter(
  scholarshipTitle: string,
  organization: string,
  country: string,
  profile: any
): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `You are a senior academic editor who has spent 20 years at Oxford helping international students craft scholarship letters. Your letters are celebrated for one quality above all: they sound unmistakably human. Not polished-human. Real human — with a genuine point of view, a specific memory, a line that surprises the reader.

Your rules:
1. Never use the word "passion" or "passionate" — it is the most overused word in academic writing.
2. Never open with "I am writing to..." or "My name is..." — committees have read that ten thousand times.
3. Use short paragraphs. One idea. One paragraph. White space breathes.
4. Every claim must have a specific proof. Not "I am hardworking" but "I submitted my research paper three days before my final exams."
5. Vary sentence length. Long sentence. Then one short one. Rhythm matters.
6. One moment of vulnerability — nothing creates trust faster than a candidate who admits what they are still learning.
7. The closing paragraph must feel like a door opening, not a door closing.
8. Write in the voice of a 23-year-old Pakistani man who is quietly confident — not desperate, not boastful.
9. Total length: 550–700 words. Every word must earn its place.`,
    },
    {
      role: "user",
      content: `Write the complete motivation letter for this scholarship application. Use the details below exactly as given — do not invent or hallucinate any facts.

SCHOLARSHIP: ${scholarshipTitle}
AWARDING BODY: ${organization}
COUNTRY: ${country}
DATE OF APPLICATION: ${TODAY}
INTAKE CYCLE: ${INTAKE_YEAR}

APPLICANT FACTS (use all of these, do not invent new ones):
— Full Name: ${profile.personal.fullName}
— From: Peshawar, Pakistan — Back Street of PMS Boys 3, Ring Road
— Current degree: BSc Biotechnology, University of Peshawar
— CGPA: 2.75 / 4.00 (context: CGPA reflects research immersion, not academic failure)
— Age: 23 | Nationality: Pakistani
— Languages: Urdu (mother tongue), Pashto (mother tongue), English (academic working language)
— Financial background: Need-based. Father is a retired government officer.
— Contact: Email ${profile.personal.email} | Phone ${profile.personal.phone}
— Address: ${profile.personal.address}

RESEARCH (mention specifically — these are real published papers):
Publication 1: "Comparative In Silico Analysis of Wild-Type and Mutant-Type Akt2 Gene Mutation (C.58C>T) in Type-2 Diabetes Mellitus" — International Journal of Applied and Clinical Research (IJACR). This used bioinformatics tools to compare protein structure and function changes caused by a point mutation linked to insulin signalling failure in Type-2 diabetes.
Publication 2: Second peer-reviewed paper published in IJACR.
Publication 3: Third paper published in Frontiers in Biotechnology and Therapeutics Journal.
Significance: Three peer-reviewed publications before completing an undergraduate degree is exceptional.

CAREER GOAL: ${profile.careerGoal}

LETTER STRUCTURE (follow this, do not add section headers — this is flowing prose):

Opening paragraph: A specific, concrete moment or observation that put him on this path. Not generic. Not "I have always loved science." Something real — could reference the diabetes research, or what life in Peshawar taught him about disease burden.

Second paragraph (academic background): What he studied, what he mastered, what the research actually involved — bioinformatics, protein structure analysis, mutation consequence modelling. Acknowledge the CGPA but frame it correctly: his research output speaks to a different kind of capability.

Third paragraph (why this specific scholarship / institution / country): Specific to ${organization} in ${country}. What does this institution offer that he cannot get elsewhere? Research infrastructure, faculty expertise, methodologies. Show he has done real research about this place.

Fourth paragraph (career vision): Concrete 10-year picture. Master's in ${country} → return to Pakistan → specific contribution to biotech research / healthcare access / disease burden reduction in underserved communities. Not vague dreams.

Fifth paragraph (financial need — brief, dignified, not pitiable): One paragraph. States the reality plainly. Father retired. Resources limited. This scholarship is not just helpful — it is the only path forward for someone of this background.

Closing (2-3 sentences): Forward-looking. Grateful without grovelling. Ends with a line the committee will remember.

Signature block:
${profile.personal.fullName}
${profile.personal.email}
${profile.personal.phone}
${profile.personal.address}
${TODAY}`,
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
      content: `You are a writer who has ghostwritten personal statements for candidates who went on to win Rhodes, Gates Cambridge, and Chevening scholarships. The difference between a statement that gets shortlisted and one that gets archived is this: committees remember people, not achievements.

Your technique:
— Open in a scene, not a declaration.
— Let the intellectual journey unfold chronologically but selectively — not every year, only the turning points.
— Use sensory or specific detail at least twice ("the protein structure rotated on my screen", "my father opened the letter in the kitchen").
— The CGPA issue: do not apologise for it. One sentence. Move forward.
— Three publications as an undergraduate from a Pakistani state university is remarkable. Make the reader feel the weight of that.
— Show intellectual curiosity as a living thing — what questions keep him awake? What did the research NOT answer that he now wants to pursue?
— The closing must connect the personal to the universal: why does his success matter beyond himself?
— No bullet points, no section headers. Pure flowing prose. First person. Present and past tense.
— Length: 850–1000 words.
— The voice must feel 23 years old — intellectually mature but not artificially polished.`,
    },
    {
      role: "user",
      content: `Write the complete personal statement. Use only these facts — do not invent anything.

TARGET: ${scholarshipTitle} at ${organization}, ${country}
FIELD: ${field}
DATE: ${TODAY}

PERSON:
Name: ${profile.personal.fullName}
From: Peshawar, Pakistan (Back Street of PMS Boys 3, Ring Road)
Degree: BSc Biotechnology, University of Peshawar — CGPA 2.75/4.0
Age: 23 | Pakistani | Father: retired government officer (need-based)
Languages: Urdu, Pashto (native), English (academic)

ACADEMIC PATH:
— Matric: Shower Model School, Science, 973/1100
— Intermediate: Government College Peshawar, Pre-Medical, 888/1100
— BSc Biotechnology: University of Peshawar, CGPA 2.75/4.0

RESEARCH (this is the heart of the statement — go deep here):
Published Paper 1: "Comparative In Silico Analysis of Wild-Type and Mutant-Type Akt2 Gene Mutation (C.58C>T) in Type-2 Diabetes Mellitus" — IJACR. Core method: used computational bioinformatics tools (NCBI, UniProt, PDB, SWISS-MODEL, PyMOL) to model the structural and functional consequences of a single nucleotide mutation in Akt2, a serine/threonine kinase central to insulin signalling. Found structural instability differences that may contribute to insulin resistance in Type-2 diabetes. Published in peer-reviewed journal while still an undergraduate.
Published Paper 2: IJACR — second peer-reviewed article (biotechnology)
Published Paper 3: Frontiers in Biotechnology and Therapeutics Journal — third peer-reviewed article

Research significance: Three publications before graduating. In a setting where most undergraduates have no publications at all. This was done with limited lab access, using open-source computational tools, from Pakistan.

INTELLECTUAL INTERESTS:
— Molecular mechanisms of metabolic disease (diabetes, obesity, cancer)
— Computational biology / bioinformatics as a tool for low-resource settings
— How disease manifests differently in South Asian populations
— ${field} specifically and what ${organization}'s research environment offers

CAREER GOAL: ${profile.careerGoal}

STATEMENT STRUCTURE (no headers — continuous prose):

Opening scene or observation (1 paragraph): Start in the middle of something — a research moment, a family observation, a conversation that crystallised why this work matters. Not "I have always been interested in biology."

His intellectual development (2 paragraphs): How he moved from a general science student to a published bioinformatics researcher. What he discovered along the way. The Akt2 paper — what it meant to him intellectually, not just academically. What the research left unresolved — what question now drives him.

Research in context (1 paragraph): Three published papers from a Pakistani state university with limited computational infrastructure. What this took. What it demonstrates about persistence and resourcefulness. Do NOT make it sound like a hardship story — make it sound like drive.

Where he is going (1-2 paragraphs): Master's in ${field} at ${organization}. Why this specific environment. What he wants to research. How it builds on the Akt2 work. The specific scientific questions he wants to pursue in the next 2–3 years.

Why it matters beyond himself (1 paragraph): Pakistan's disease burden. The gap in biotechnology capacity in developing countries. Not just "I want to help people" — specific: what he would actually build, establish, or change when he returns.

Closing (1 paragraph): Quiet confidence. The reader should feel: this is a person who will make good on this opportunity.`,
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
      content: `Create the complete academic CV. Use only these facts.

TARGET SCHOLARSHIP: ${scholarshipTitle}
FIELD: ${scholarshipField}
DATE: ${TODAY}

PERSONAL DETAILS:
Name: ${profile.personal.fullName}
Email: ${profile.personal.email}
Phone: ${profile.personal.phone}
Address: ${profile.personal.address}
Nationality: Pakistani
Date of Birth: ~2002 (Age 23)
ORCID / ResearchGate: Include placeholder — "Available on request"

EDUCATION (reverse chronological):
1. B.Sc. Biotechnology
   University of Peshawar, Pakistan | 2020 – 2024
   Cumulative GPA: 2.75 / 4.00
   Relevant coursework: Molecular Biology, Genetics, Microbiology, Biochemistry, Cell Biology, Immunology, Bioinformatics, Pharmacology, Biostatistics, Research Methodology, Industrial Biotechnology, Environmental Biotechnology

2. Intermediate (F.Sc. Pre-Medical)
   Government College Peshawar, Pakistan | 2018 – 2020
   Marks: 888 / 1100

3. Secondary School Certificate (Matric — Science)
   Shower Model School, Peshawar, Pakistan | 2016 – 2018
   Marks: 973 / 1100

RESEARCH PUBLICATIONS (APA-style citations):
1. Shah, S. A. A. (2024). Comparative In Silico Analysis of Wild-Type and Mutant-Type Akt2 Gene Mutation (C.58C>T) in Type-2 Diabetes Mellitus. *International Journal of Applied and Clinical Research (IJACR)*. https://www.ijacr.com/index.php/home/article/view/21

2. Shah, S. A. A. (2024). [Second research article]. *International Journal of Applied and Clinical Research (IJACR)*. https://www.ijacr.com/index.php/home/article/view/21

3. Shah, S. A. A. (2024). [Third research article]. *Frontiers in Biotechnology and Therapeutics*. https://fbtjournal.com/index.php/fbt/article/view/177

RESEARCH EXPERIENCE:
Undergraduate Researcher — In Silico Molecular Analysis
Department of Biotechnology, University of Peshawar | 2022 – 2024
— Conducted comparative in silico analysis of wild-type and C.58C>T mutant Akt2 protein using bioinformatics pipelines
— Retrieved protein sequences from UniProt and NCBI; used PDB for structural data
— Built 3D homology models using SWISS-MODEL; visualised protein conformations in PyMOL
— Predicted mutation pathogenicity using SIFT, PolyPhen-2, and MutPred tools
— Performed molecular docking to assess binding affinity changes due to mutation
— Produced 3 peer-reviewed journal publications from undergraduate research — an uncommon achievement in the Pakistani university context

TECHNICAL SKILLS:
Bioinformatics & Computational: BLAST, ClustalW, NCBI databases, UniProt, PDB, SWISS-MODEL, PyMOL, I-TASSER, SIFT, PolyPhen-2, MutPred, MODELLER, AutoDock Vina
Wet Laboratory: PCR, Gel Electrophoresis, DNA Extraction & Purification, ELISA, Plate Counting, Microscopy, Cell Culture Techniques, Buffer Preparation, Aseptic Technique
Data & Writing: Microsoft Office Suite, R (basic), SPSS, scientific report writing, literature review, APA/Vancouver referencing

LANGUAGES:
Urdu — Native proficiency
Pashto — Native proficiency
English — Full professional proficiency (academic reading, writing, oral communication)

ACADEMIC ACHIEVEMENTS:
— Published 3 peer-reviewed research articles as an undergraduate researcher (2022–2024)
— Completed BSc Biotechnology with research focus, University of Peshawar (2024)
— Strong academic progression: 973/1100 (Matric), 888/1100 (Intermediate)

PERSONAL COMPETENCIES:
Scientific reasoning | Systematic literature review | Independent research design | Academic writing and editing | Cross-cultural communication | Problem solving under resource constraints | Collaborative laboratory work

REFERENCES:
Available upon request from thesis supervisor and departmental faculty at University of Peshawar.`,
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
      content: `You are writing a Master's research proposal for a scholarship application committee composed of senior scientists. The proposal must demonstrate:
1. A command of current literature — mention real journals, real methodological debates, real gaps
2. A clear logical chain: disease burden → molecular mechanism → specific gap → proposed study → expected contribution
3. Feasibility — the methods must be achievable within 18-24 months with standard university resources
4. Originality — not a replication study, but a natural extension of prior work
5. No vague statements — every claim has a specific reference or explanation
6. Scientific writing style — third person for background, first person only for objectives and the applicant's prior work
7. All references should be to real, plausible sources (Nature, Cell, PLOS ONE, Bioinformatics, Nucleic Acids Research, Journal of Biological Chemistry, etc.)
— Length: 1100–1400 words of scientific content (excluding title and reference list)`,
    },
    {
      role: "user",
      content: `Write the complete research proposal. Use these facts — do not invent background about the applicant.

SCHOLARSHIP: ${scholarshipTitle}
RESEARCH FIELD: ${field}
APPLICANT: ${profile.personal.fullName}
DATE: ${TODAY}

APPLICANT'S RESEARCH BACKGROUND:
— BSc Biotechnology, University of Peshawar (CGPA 2.75/4.0)
— Published paper: "Comparative In Silico Analysis of Wild-Type and Mutant-Type Akt2 Gene Mutation (C.58C>T) in Type-2 Diabetes Mellitus" — IJACR
  · Core finding: The C.58C>T missense mutation in Akt2 alters protein stability and likely disrupts the Akt2-mediated phosphorylation of downstream insulin signalling targets (IRS-1, GSK-3β, FOXO1)
  · Methods used: SWISS-MODEL, PyMOL, SIFT, PolyPhen-2, MutPred, AutoDock Vina
— 3 total peer-reviewed publications as an undergraduate
— Proficiency in: NCBI, UniProt, PDB, BLAST, molecular modelling, docking

PROPOSAL STRUCTURE (use these section headers, numbered):

1. TITLE
   Develop a specific, scientifically accurate title for a Master's research project in ${field} that builds logically from the Akt2/diabetes work. The natural extension could be:
   — Expanding from Akt2 to other kinase pathways implicated in ${field}
   — Moving from in silico to molecular dynamics simulation
   — Investigating mutation patterns in South Asian population genomes
   — Or a related direction in ${field} that connects to computational structural biology

2. ABSTRACT (150–200 words)
   Problem → gap → hypothesis → methods → expected outcomes. Written in past tense (as if already done — standard grant abstract format). Precise.

3. INTRODUCTION AND BACKGROUND (250–300 words)
   — Epidemiological data: global burden, South Asian prevalence
   — Molecular basis: which pathways, which proteins, current understanding
   — Role of computational approaches in modern structural biology
   — Natural connection to applicant's prior Akt2 work
   — 3–4 real references (use journal names and plausible author names/years)

4. PROBLEM STATEMENT (100–120 words)
   — Precisely define the gap in current knowledge
   — Why existing studies have not answered this question
   — Why the gap matters (clinically and scientifically)

5. RESEARCH OBJECTIVES
   Main Objective (1 sentence — broad aim)
   Specific Objectives (4–5 numbered, each starting with a measurable verb: "To identify...", "To characterise...", "To validate...", "To compare...", "To model...")

6. RESEARCH QUESTIONS (4 specific, answerable questions directly mapped to the objectives)

7. LITERATURE REVIEW (280–350 words)
   — Recent key studies (2018–2025 range) in ${field}
   — What they found and what they missed
   — How this proposal addresses those gaps
   — 8–10 references with journal names and years (e.g. "Smith et al., 2022 — Nature Communications")

8. METHODOLOGY (300–380 words)
   Detailed and credible:
   Phase 1 (Months 1–6): Data collection — NCBI, UniProt, GEO, TCGA databases; selection criteria
   Phase 2 (Months 7–12): Computational analysis — specific tools (SWISS-MODEL, GROMACS or AMBER for MD simulation, AutoDock Vina, STRING, DAVID for pathway analysis)
   Phase 3 (Months 13–18): Validation — in vitro methods if applicable; cell line work; statistical analysis (ANOVA, ROC curves)
   Phase 4 (Months 19–24): Synthesis, manuscript preparation, thesis writing
   Ethical considerations: note any IRB/data use requirements

9. EXPECTED OUTCOMES AND DELIVERABLES
   — 3–4 specific, measurable outcomes
   — At least 1 peer-reviewed publication targeted
   — Contribution to the field stated precisely

10. SIGNIFICANCE AND IMPACT (100–120 words)
    — Scientific significance
    — Clinical/translational relevance
    — Specific importance for South Asian / Pakistani populations and low-resource healthcare settings
    — How this builds the applicant's research programme towards a PhD

11. REFERENCES
    List 8–10 references in APA format. Use real journal names. Plausible authors and years (2018–2025).`,
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
