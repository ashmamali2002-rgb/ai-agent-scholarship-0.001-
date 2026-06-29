-- ============================================================
-- GETSCO — Multi-user SaaS schema (Supabase / Postgres)
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE).
--
-- Every table is owned by a user (auth.users) and protected by
-- Row-Level Security so a user can ONLY read/write their own rows.
-- ============================================================

-- ---------- PROFILES (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  -- Personal
  full_name text,
  gender text,
  date_of_birth date,
  nationality text,
  country_of_residence text,
  city text,
  passport_number text,
  passport_expiry date,
  phone text,
  address text,
  -- Academic
  current_degree text,
  university text,
  cgpa numeric,
  cgpa_scale numeric default 4.0,
  graduation_year int,
  field_of_study text,
  thesis_title text,
  research_interests text,
  preferred_master_fields text,
  -- Language tests (JSON: { ielts: {...}, toefl: {...}, gre: {...}, others: [...] })
  language_tests jsonb default '{}'::jsonb,
  -- Scholarship preferences
  preferred_countries text,
  funding_type text default 'Fully Funded',
  degree_level text default 'Masters',
  research_areas text,
  -- Goals
  career_goal text,
  financial_status text,
  family_background text,
  -- Meta
  profile_completion int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- PUBLICATIONS ----------
create table if not exists public.publications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  journal text,
  url text,
  year int,
  description text,
  created_at timestamptz default now()
);

-- ---------- ACADEMIC RECORDS ----------
create table if not exists public.academic_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null,
  institution text not null,
  field text,
  marks_obtained text,
  total_marks text,
  year int
);

-- ---------- SCHOLARSHIPS (per user) ----------
create table if not exists public.scholarships (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  organization text,
  country text,
  field text,
  level text,
  amount text,
  deadline text,
  deadline_type text default 'unknown',
  description text,
  requirements text,
  url text,
  covers text,
  match_score numeric default 0,
  success_probability int default 0,
  recommendation_reason text,
  is_fully_funded boolean default false,
  status text default 'found',
  source text,
  source_trust_level text default 'unknown',
  source_domain text,
  is_expired boolean default false,
  verified boolean default false,
  link_ok boolean default false,
  created_at timestamptz default now(),
  unique (user_id, url)
);

-- ---------- PROFESSORS (per user) ----------
create table if not exists public.professors (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  university text not null,
  department text,
  country text,
  field text,
  name text not null,
  title text,
  email text,
  linkedin_url text,
  profile_url text,
  lab_name text,
  lab_website text,
  google_scholar_url text,
  research_interests text,
  recent_publications jsonb default '[]'::jsonb,
  matched_topics jsonb default '[]'::jsonb,
  matched_keywords jsonb default '[]'::jsonb,
  recommendation_reason text,
  accepting_students text default 'unknown',
  relevance_score int default 0,
  raw_bio text,
  source_url text,
  verified boolean default false,
  location_status text default 'unverified',
  recommendation_type text default 'university',
  created_at timestamptz default now()
);

-- ---------- APPLICATIONS ----------
create table if not exists public.applications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scholarship_id bigint references public.scholarships(id) on delete set null,
  status text default 'preparing',
  notes text,
  deadline text,
  email_sent boolean default false,
  email_sent_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- DOCUMENTS ----------
create table if not exists public.documents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id bigint references public.applications(id) on delete set null,
  scholarship_id bigint references public.scholarships(id) on delete set null,
  type text not null,
  title text not null,
  content text not null,
  references_total int default 0,
  references_verified int default 0,
  created_at timestamptz default now()
);

-- ---------- SAVED SCHOLARSHIPS / PROFESSORS ----------
create table if not exists public.saved_scholarships (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scholarship_id bigint not null references public.scholarships(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, scholarship_id)
);
create table if not exists public.saved_professors (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  professor_id bigint not null references public.professors(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, professor_id)
);

-- ---------- USER FILES (Supabase Storage metadata) ----------
create table if not exists public.user_files (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,           -- transcript | degree | passport | cv | recommendation | certificate | research_paper
  file_name text not null,
  storage_path text not null,       -- path in the 'user-files' storage bucket
  mime_type text,
  size_bytes bigint,
  created_at timestamptz default now()
);

-- ---------- NOTIFICATIONS ----------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ---------- ACTIVITY LOG ----------
create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  detail text,
  created_at timestamptz default now()
);

-- ---------- SUBSCRIPTIONS (payment-ready, not yet charged) ----------
create table if not exists public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free',          -- free | premium | enterprise
  status text not null default 'active',      -- active | past_due | canceled
  provider text,                              -- stripe | local_gateway | null
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

-- ---------- PAYMENTS / INVOICES ----------
create table if not exists public.payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric,
  currency text default 'USD',
  status text,                                -- paid | pending | failed | refunded
  provider text,
  provider_payment_id text,
  invoice_url text,
  description text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW-LEVEL SECURITY — users can only touch their own rows
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','publications','academic_records','scholarships','professors',
    'applications','documents','saved_scholarships','saved_professors',
    'user_files','notifications','activity_logs','subscriptions','payments'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    -- profiles keys on id; everything else on user_id
    if t = 'profiles' then
      execute format($p$
        create policy "own_select" on public.%1$I for select using (auth.uid() = id);
        create policy "own_insert" on public.%1$I for insert with check (auth.uid() = id);
        create policy "own_update" on public.%1$I for update using (auth.uid() = id);
        create policy "own_delete" on public.%1$I for delete using (auth.uid() = id);
      $p$, t);
    else
      execute format($p$
        create policy "own_select" on public.%1$I for select using (auth.uid() = user_id);
        create policy "own_insert" on public.%1$I for insert with check (auth.uid() = user_id);
        create policy "own_update" on public.%1$I for update using (auth.uid() = user_id);
        create policy "own_delete" on public.%1$I for delete using (auth.uid() = user_id);
      $p$, t);
    end if;
  end loop;
exception when duplicate_object then
  null; -- policies already exist; ignore on re-run
end $$;

-- ============================================================
-- AUTO-PROVISIONING — when a user signs up, create their
-- profile + a free subscription automatically (no app key needed).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- helpful indexes ----------
create index if not exists idx_sch_user on public.scholarships(user_id);
create index if not exists idx_sch_score on public.scholarships(match_score);
create index if not exists idx_prof_user on public.professors(user_id);
create index if not exists idx_doc_user on public.documents(user_id);
create index if not exists idx_app_user on public.applications(user_id);
create index if not exists idx_notif_user on public.notifications(user_id);

-- Done. Next: create a Storage bucket named 'user-files' (private) in the
-- Storage section for document uploads (handled in a later milestone).
