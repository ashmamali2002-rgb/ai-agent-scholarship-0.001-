// ============================================================
// GETSCO — Recommendation scoring helpers
// Deterministic (no extra AI calls) success-probability and
// recommendation-reason generation. Used at insert time so every
// scholarship row carries these Phase-2 fields.
// ============================================================

export function computeSuccessProbability(
  matchScore: number,
  isFullyFunded: boolean,
  trustLevel: string
): number {
  const official = trustLevel === "official";
  if (matchScore >= 85 && isFullyFunded && official) return 75;
  if (matchScore >= 75 && isFullyFunded) return 65;
  if (matchScore >= 65 && isFullyFunded) return 55;
  if (matchScore >= 65) return 45;
  if (matchScore >= 50) return 35;
  return 25;
}

// Short, specific reason string keyed off country + score.
// No AI call — fast and free, runs on every insert.
export function buildRecommendationReason(country: string, matchScore: number): string {
  const c = (country || "").toLowerCase();
  if (matchScore >= 70) {
    if (c.includes("germany")) return "Strong biotech research infrastructure; DAAD has dedicated quotas for Pakistani researchers with publications.";
    if (c.includes("japan")) return "MEXT heavily weights research output — 3 undergraduate publications is exceptional by Japanese standards.";
    if (c.includes("korea")) return "GKS strongly considers need-based candidates and actively recruits biotech talent from Pakistan.";
    if (c.includes("china")) return "CSC scholarships have a high acceptance rate for Pakistani applicants with a research background.";
    if (c.includes("taiwan")) return "Taiwan ICDF prioritises applicants from developing countries with demonstrated research ability.";
    if (c.includes("sweden")) return "Swedish Institute values leadership and research; need-based profile fits its global-professionals aim.";
    if (c.includes("france")) return "Eiffel Excellence targets high-performing master's candidates; your publications strengthen the case.";
    if (c.includes("international") || c.includes("europe")) return "Global programme aligned with your biotechnology research profile and need-based status.";
    return "Strong overall fit for your profile — research output and field alignment are well above the typical applicant.";
  }
  if (matchScore >= 50) return "Reasonable match — review the eligibility criteria (GPA minimums, country list) carefully before applying.";
  return "Possible match. Confirm eligibility and funding scope on the official page before investing time.";
}

// Classify a deadline string into a visual bucket for UI badges.
export function classifyDeadline(deadline: string): "active" | "future" | "check" | "unknown" {
  const d = (deadline || "").toLowerCase();
  if (!d) return "unknown";
  if (d.startsWith("annual") || d.startsWith("check")) return "check";
  if (d.includes("2027")) return "future";
  if (d.includes("2026")) return "active";
  return "active";
}
