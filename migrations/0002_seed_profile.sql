-- Seed Syed Ashmam Ali Shah's Profile
INSERT OR IGNORE INTO user_profile (
  id, full_name, email, age, nationality, country_of_residence,
  current_qualification, university, cgpa, field_of_study,
  financial_status, family_background, career_goal, languages
) VALUES (
  1,
  'Syed Ashmam Ali Shah',
  'ashmam@scholarshipagent.com',
  23,
  'Pakistani',
  'Pakistan',
  'Bachelor''s in Biotechnology',
  'University of Peshawar, Pakistan',
  2.75,
  'Biotechnology',
  'Need-Based (Father is a retired government officer)',
  'Father is a retired government officer; from a developing country with limited access to advanced healthcare and scientific facilities',
  'To become a biotechnology researcher dedicated to improving human health through meaningful scientific innovation and medical research. Aspires to contribute to the discovery of affordable and effective solutions for diseases affecting millions especially in underprivileged communities. Aims to bring advanced scientific knowledge and modern biotechnology practices back to Pakistan.',
  'Urdu, English, Pashto'
);

-- Academic Records
INSERT OR IGNORE INTO academic_records (user_id, level, institution, field, marks_obtained, total_marks) VALUES
(1, 'Matriculation', 'Shower Model School', 'Science', '973', '1100'),
(1, 'Intermediate', 'Government College Peshawar', 'Pre-Medical', '888', '1100'),
(1, 'Bachelor''s Degree', 'University of Peshawar', 'Biotechnology', 'CGPA 2.75', 'CGPA 4.0');

-- Research Publications
INSERT OR IGNORE INTO publications (user_id, title, journal, url, description) VALUES
(1, 'Comparative In Silico Analysis of Wild-Type and Mutant-Type Akt2 Gene Mutation (C.58C>T) in Type-2 Diabetes Mellitus', 'International Journal of Applied and Clinical Research (IJACR)', 'https://www.ijacr.com/index.php/home/article/view/21', 'Computational biology research on Akt2 gene mutations in Type-2 Diabetes'),
(1, 'Research Publication 2', 'International Journal of Applied and Clinical Research (IJACR)', 'https://www.ijacr.com/index.php/home/article/view/21', 'Published in IJACR journal'),
(1, 'Research Publication 3', 'Frontiers in Biotechnology and Therapeutics Journal', 'https://fbtjournal.com/index.php/fbt/article/view/177', 'Published in Frontiers in Biotechnology and Therapeutics');

-- Target Countries
INSERT OR IGNORE INTO target_countries (user_id, country, priority) VALUES
(1, 'United States', 1),
(1, 'Canada', 1),
(1, 'Australia', 1),
(1, 'Germany', 2),
(1, 'Japan', 2),
(1, 'South Korea', 2),
(1, 'Taiwan', 2),
(1, 'China', 2),
(1, 'Sweden', 3),
(1, 'France', 3),
(1, 'Saudi Arabia', 3),
(1, 'United Arab Emirates', 3),
(1, 'Qatar', 3),
(1, 'Kuwait', 3);

-- Preferred Fields
INSERT OR IGNORE INTO preferred_fields (user_id, field, priority) VALUES
(1, 'Biotechnology', 1),
(1, 'Molecular Biology', 1),
(1, 'Genetics', 1),
(1, 'Microbiology', 2),
(1, 'Immunology', 2),
(1, 'Cancer Biology', 2),
(1, 'Biomedical Sciences', 2),
(1, 'Biomedical Engineering', 3),
(1, 'Pharmacology', 3),
(1, 'Pharmaceutical Biotechnology', 3),
(1, 'Clinical Research', 3),
(1, 'Neuroscience', 3),
(1, 'Regenerative Medicine', 3),
(1, 'Public Health', 4),
(1, 'Epidemiology', 4),
(1, 'Data Science', 4),
(1, 'Artificial Intelligence in Healthcare', 4);
