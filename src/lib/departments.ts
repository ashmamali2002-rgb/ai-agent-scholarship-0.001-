// ============================================================
// GETSCO — Department Intelligence
// Maps an academic field/specialisation to the real department
// names and search/scoring vocabulary used worldwide. Lets the
// professor finder target the CORRECT department (e.g. Cancer
// Biology -> Oncology) instead of defaulting to "Biotechnology".
// ============================================================

export interface FieldMap {
  departments: string[];   // department names to target in search
  areas: string[];         // research vocabulary used for relevance scoring
}

// Keys are matched case-insensitively by substring, so "Cancer Biology"
// and "cancer" both resolve. Order matters: more specific first.
const FIELD_MAP: Array<{ match: string[]; data: FieldMap }> = [
  { match: ["cancer", "oncolog", "tumour", "tumor"], data: {
    departments: ["Oncology", "Cancer Biology", "Tumour Biology", "Cancer Research", "Molecular Oncology"],
    areas: ["oncology", "tumour biology", "cancer genomics", "carcinogenesis", "apoptosis", "cancer immunology"] } },
  { match: ["genetic", "genomic"], data: {
    departments: ["Genetics", "Genomics", "Human Genetics", "Molecular Genetics"],
    areas: ["genetics", "genomics", "gene expression", "mutation analysis", "CRISPR", "sequencing"] } },
  { match: ["immunolog"], data: {
    departments: ["Immunology", "Microbiology and Immunology", "Immunobiology"],
    areas: ["immunology", "immune response", "T cells", "antibodies", "vaccines", "autoimmunity"] } },
  { match: ["microbiolog"], data: {
    departments: ["Microbiology", "Microbiology and Immunology", "Molecular Microbiology"],
    areas: ["microbiology", "bacteriology", "virology", "antimicrobial resistance", "pathogens"] } },
  { match: ["neuro"], data: {
    departments: ["Neuroscience", "Neurobiology", "Brain and Cognitive Sciences"],
    areas: ["neuroscience", "neurobiology", "synaptic", "neurodegeneration", "brain imaging"] } },
  { match: ["pharmacolog", "pharmaceutic", "pharma"], data: {
    departments: ["Pharmacology", "Pharmacology and Toxicology", "Pharmaceutical Sciences"],
    areas: ["pharmacology", "drug discovery", "pharmacokinetics", "toxicology", "medicinal chemistry"] } },
  { match: ["biomedical engineer", "bioengineer"], data: {
    departments: ["Biomedical Engineering", "Bioengineering"],
    areas: ["biomedical engineering", "biomaterials", "tissue engineering", "medical devices", "biomechanics"] } },
  { match: ["biomedical", "biomedicine"], data: {
    departments: ["Biomedical Sciences", "Biomedicine", "Molecular Medicine"],
    areas: ["biomedical sciences", "disease mechanisms", "translational research", "molecular medicine"] } },
  { match: ["public health", "epidemiolog", "global health"], data: {
    departments: ["Public Health", "Epidemiology", "Global Health"],
    areas: ["epidemiology", "public health", "disease surveillance", "biostatistics", "health policy"] } },
  { match: ["bioinformatic", "computational biolog", "systems biolog", "data science"], data: {
    departments: ["Bioinformatics", "Computational Biology", "Systems Biology"],
    areas: ["bioinformatics", "computational biology", "machine learning", "protein structure", "sequence analysis"] } },
  { match: ["molecular biolog", "biochem"], data: {
    departments: ["Molecular Biology", "Biochemistry and Molecular Biology", "Cell and Molecular Biology"],
    areas: ["molecular biology", "biochemistry", "protein", "signalling pathways", "gene regulation"] } },
  { match: ["regenerative", "stem cell"], data: {
    departments: ["Regenerative Medicine", "Stem Cell Biology"],
    areas: ["regenerative medicine", "stem cells", "tissue regeneration", "cell therapy"] } },
  { match: ["toxicolog"], data: {
    departments: ["Toxicology", "Pharmacology and Toxicology"],
    areas: ["toxicology", "drug safety", "environmental toxins", "risk assessment"] } },
  { match: ["food", "nutrition"], data: {
    departments: ["Food Science", "Food Biotechnology", "Nutrition"],
    areas: ["food science", "food biotechnology", "nutrition", "fermentation", "food safety"] } },
  { match: ["environmental", "marine", "agricultur"], data: {
    departments: ["Environmental Biotechnology", "Agricultural Biotechnology", "Marine Biotechnology"],
    areas: ["environmental biotechnology", "bioremediation", "agricultural biotechnology", "sustainability"] } },
  { match: ["biotech"], data: {
    departments: ["Biotechnology", "Biological Sciences", "Life Sciences"],
    areas: ["biotechnology", "bioprocessing", "molecular biology", "genetic engineering", "fermentation"] } },
];

export function mapFieldToDepartments(field: string): FieldMap {
  const f = (field || "").toLowerCase().trim();
  if (f) {
    for (const entry of FIELD_MAP) {
      if (entry.match.some(m => f.includes(m))) return entry.data;
    }
  }
  // Unknown field: use the field itself as both department and area so the
  // search still targets the user's actual interest rather than biotech.
  if (f) return { departments: [field], areas: [f] };
  return FIELD_MAP[FIELD_MAP.length - 1].data; // biotech fallback only when no field given
}

// The list of fields offered in the UI dropdown.
export const FIELD_OPTIONS = [
  "Biotechnology", "Molecular Biology", "Genetics", "Microbiology",
  "Immunology", "Cancer Biology", "Biomedical Sciences", "Biomedical Engineering",
  "Pharmacology", "Neuroscience", "Bioinformatics", "Public Health",
  "Regenerative Medicine", "Toxicology", "Food Science", "Environmental Biotechnology",
];
