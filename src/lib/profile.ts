// ============================================
// User Profile - Syed Ashmam Ali Shah
// Complete profile for scholarship matching
// ============================================

export const CURRENT_DATE = "June 6, 2026";
export const CURRENT_YEAR = 2026;

export const USER_PROFILE = {
  personal: {
    fullName: "Syed Ashmam Ali Shah",
    email: "ashmamali2002@gmail.com",
    phone: "+92 347 1978085",
    address: "Back Street of PMS Boys 3, Ring Road, Peshawar, Pakistan",
    age: 23,
    nationality: "Pakistani",
    countryOfResidence: "Pakistan",
    languages: ["Urdu", "English", "Pashto"],
    financialStatus: "Need-Based",
    familyBackground: "Father is a retired government officer",
  },
  academic: {
    currentQualification: "Bachelor's in Biotechnology",
    university: "University of Peshawar, Pakistan",
    cgpa: 2.75,
    cgpaScale: 4.0,
    fieldOfStudy: "Biotechnology",
    records: [
      { level: "Matriculation", institution: "Shower Model School", field: "Science", marks: "973/1100" },
      { level: "Intermediate", institution: "Government College Peshawar", field: "Pre-Medical", marks: "888/1100" },
      { level: "Bachelor's", institution: "University of Peshawar", field: "Biotechnology", marks: "CGPA 2.75/4.0" },
    ],
  },
  research: {
    totalPublications: 3,
    publications: [
      {
        title: "Comparative In Silico Analysis of Wild-Type and Mutant-Type Akt2 Gene Mutation (C.58C>T) in Type-2 Diabetes Mellitus",
        journal: "International Journal of Applied and Clinical Research (IJACR)",
        url: "https://www.ijacr.com/index.php/home/article/view/21",
        type: "Computational Biology",
      },
      {
        title: "Research Publication 2",
        journal: "International Journal of Applied and Clinical Research (IJACR)",
        url: "https://www.ijacr.com/index.php/home/article/view/21",
        type: "Biotechnology",
      },
      {
        title: "Research Publication 3",
        journal: "Frontiers in Biotechnology and Therapeutics Journal",
        url: "https://fbtjournal.com/index.php/fbt/article/view/177",
        type: "Biotechnology Therapeutics",
      },
    ],
  },
  careerGoal: `To become a biotechnology researcher dedicated to improving human health through meaningful scientific innovation and medical research. Coming from Pakistan, aspires to contribute to discovery of affordable and effective solutions for diseases affecting millions especially in underprivileged communities. Aims to bring advanced scientific knowledge, research culture, and modern biotechnology practices back to Pakistan to contribute to scientific and healthcare development.`,
  preferredFields: [
    "Biotechnology", "Molecular Biology", "Genetics", "Microbiology",
    "Immunology", "Cancer Biology", "Biomedical Sciences", "Biomedical Engineering",
    "Pharmacology", "Pharmaceutical Biotechnology", "Clinical Research",
    "Neuroscience", "Regenerative Medicine", "Public Health", "Epidemiology",
    "Toxicology", "Industrial Biotechnology", "Biochemical Engineering",
    "Food Biotechnology", "Food Science and Technology", "Environmental Biotechnology",
    "Agricultural Biotechnology", "Marine Biotechnology",
    "Artificial Intelligence in Healthcare", "Data Science", "Biotechnology Management",
  ],
  targetCountries: [
    "United States", "Canada", "Australia", "Japan", "South Korea",
    "Taiwan", "China", "Sweden", "France", "Germany", "Saudi Arabia",
    "United Arab Emirates", "Qatar", "Kuwait",
  ],
  scholarshipRequirements: {
    type: "Fully Funded",
    covers: ["Tuition Fee", "Monthly Stipend", "Accommodation", "Health Insurance", "Airfare", "Research Support", "Laboratory Facilities"],
    level: "Master's Degree",
    needBased: true,
    meritBased: true,
  },
};

export function buildProfileSummary(): string {
  return `
CANDIDATE PROFILE (Today: ${CURRENT_DATE}):
Name: ${USER_PROFILE.personal.fullName}
Email: ${USER_PROFILE.personal.email} | Phone: ${USER_PROFILE.personal.phone}
Address: ${USER_PROFILE.personal.address}
Age: ${USER_PROFILE.personal.age} | Nationality: ${USER_PROFILE.personal.nationality}
Current Degree: ${USER_PROFILE.academic.currentQualification} - CGPA: ${USER_PROFILE.academic.cgpa}/${USER_PROFILE.academic.cgpaScale}
University: ${USER_PROFILE.academic.university}
Research Publications: ${USER_PROFILE.research.totalPublications} published papers in peer-reviewed journals
Financial Status: ${USER_PROFILE.personal.financialStatus} (${USER_PROFILE.personal.familyBackground})
Target: Fully Funded Master's Scholarship (2026-2027 intake)
Preferred Fields: ${USER_PROFILE.preferredFields.slice(0, 8).join(", ")}
Target Countries: ${USER_PROFILE.targetCountries.join(", ")}
Career Goal: ${USER_PROFILE.careerGoal.substring(0, 200)}...
  `.trim();
}
