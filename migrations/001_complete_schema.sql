-- Migration 001: Complete Relational PostgreSQL Schema for JobPilot AI / ResumeAI
-- Note: Live Cloud SQL schema is managed via Drizzle Kit (src/db/schema.ts).
-- This migration provides the complete portable SQL DDL specification including UUIDs,
-- foreign keys, check constraints, and performance indexes.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- A. Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  uid TEXT NOT NULL UNIQUE,
  full_name TEXT,
  display_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  default_mode TEXT NOT NULL DEFAULT 'balanced' CHECK (default_mode IN ('balanced', 'maximum_alignment', 'conservative')),
  default_template TEXT NOT NULL DEFAULT 'classic_professional',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Master Resume Locked Vault (Preserved Permanent Source)
CREATE TABLE IF NOT EXISTS master_resumes (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  original_file_name TEXT,
  original_mime_type TEXT,
  file_size_bytes INTEGER,
  structured_data JSONB NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- B. Candidate Profiles (1:1 per user)
CREATE TABLE IF NOT EXISTS candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  professional_summary TEXT NOT NULL DEFAULT '',
  total_experience TEXT NOT NULL DEFAULT '',
  current_location TEXT NOT NULL DEFAULT '',
  preferred_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_job_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_salary TEXT NOT NULL DEFAULT '',
  notice_period TEXT NOT NULL DEFAULT '',
  joining_availability TEXT NOT NULL DEFAULT '',
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  technical_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  software_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  employment_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- C. Candidate Documents (Private storage metadata)
CREATE TABLE IF NOT EXISTS candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'resume',
  storage_path TEXT NOT NULL,
  file_format TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  is_master_resume BOOLEAN NOT NULL DEFAULT FALSE,
  extracted_text TEXT NOT NULL DEFAULT '',
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- D. Job Descriptions
CREATE TABLE IF NOT EXISTS job_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_location TEXT NOT NULL DEFAULT '',
  job_description TEXT NOT NULL,
  job_url TEXT NOT NULL DEFAULT '',
  employment_type TEXT NOT NULL DEFAULT '',
  experience_required TEXT NOT NULL DEFAULT '',
  salary_range TEXT NOT NULL DEFAULT '',
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  job_source TEXT NOT NULL DEFAULT 'manual_paste',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- E. Shared Resume Templates
CREATE TABLE IF NOT EXISTS resume_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  template_category TEXT NOT NULL,
  template_description TEXT NOT NULL,
  template_preview_path TEXT NOT NULL DEFAULT '',
  ats_classification TEXT NOT NULL,
  layout_type TEXT NOT NULL,
  design_configuration JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- F. Generated Resumes
CREATE TABLE IF NOT EXISTS generated_resumes (
  id SERIAL PRIMARY KEY,
  uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  master_resume_id INTEGER REFERENCES master_resumes(id) ON DELETE SET NULL,
  job_description_id UUID REFERENCES job_descriptions(id) ON DELETE SET NULL,
  original_document_id UUID REFERENCES candidate_documents(id) ON DELETE SET NULL,
  resume_template_uuid UUID REFERENCES resume_templates(id) ON DELETE SET NULL,
  resume_title TEXT NOT NULL DEFAULT '',
  job_title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  original_jd TEXT NOT NULL,
  jd_analysis JSONB NOT NULL,
  generation_mode TEXT NOT NULL,
  template_id TEXT NOT NULL DEFAULT 'classic_professional',
  template_customization JSONB,
  tailored_resume JSONB NOT NULL,
  generated_text TEXT NOT NULL DEFAULT '',
  pdf_storage_path TEXT NOT NULL DEFAULT '',
  docx_storage_path TEXT NOT NULL DEFAULT '',
  original_ats_score INTEGER CHECK (original_ats_score IS NULL OR (original_ats_score >= 0 AND original_ats_score <= 100)),
  final_ats_score INTEGER CHECK (final_ats_score IS NULL OR (final_ats_score >= 0 AND final_ats_score <= 100)),
  keyword_match_score INTEGER CHECK (keyword_match_score IS NULL OR (keyword_match_score >= 0 AND keyword_match_score <= 100)),
  skills_match_score INTEGER CHECK (skills_match_score IS NULL OR (skills_match_score >= 0 AND skills_match_score <= 100)),
  experience_match_score INTEGER CHECK (experience_match_score IS NULL OR (experience_match_score >= 0 AND experience_match_score <= 100)),
  formatting_score INTEGER CHECK (formatting_score IS NULL OR (formatting_score >= 0 AND formatting_score <= 100)),
  missing_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvement_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  generation_status TEXT NOT NULL DEFAULT 'completed' CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed')),
  ats_analysis JSONB NOT NULL,
  factual_verification JSONB NOT NULL,
  review_report JSONB NOT NULL,
  ai_model TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- G. ATS Analysis
CREATE TABLE IF NOT EXISTS ats_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_description_id UUID REFERENCES job_descriptions(id) ON DELETE SET NULL,
  generated_resume_id INTEGER NOT NULL REFERENCES generated_resumes(id) ON DELETE CASCADE,
  original_score INTEGER NOT NULL DEFAULT 0 CHECK (original_score >= 0 AND original_score <= 100),
  final_score INTEGER NOT NULL DEFAULT 0 CHECK (final_score >= 0 AND final_score <= 100),
  required_keyword_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_required_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_keyword_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills_match JSONB NOT NULL DEFAULT '{}'::jsonb,
  experience_alignment JSONB NOT NULL DEFAULT '[]'::jsonb,
  formatting_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvement_recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- H. Discovered / Tracked Jobs (Deduplicated)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  job_description TEXT NOT NULL,
  job_url TEXT NOT NULL DEFAULT '',
  dedupe_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual',
  employment_type TEXT NOT NULL DEFAULT '',
  experience_required TEXT NOT NULL DEFAULT '',
  salary_range TEXT NOT NULL DEFAULT '',
  posting_date TIMESTAMP,
  expiry_date TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'closed', 'archived')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- I. Verified Recruiters
CREATE TABLE IF NOT EXISTS recruiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  recruiter_name TEXT NOT NULL,
  designation TEXT NOT NULL DEFAULT '',
  professional_email TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  contact_source TEXT NOT NULL DEFAULT 'user_provided',
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'bounced')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- J. Applications
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  generated_resume_id INTEGER REFERENCES generated_resumes(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  application_status TEXT NOT NULL DEFAULT 'Resume Generated' CHECK (
    application_status IN (
      'Discovered',
      'Matched',
      'Shortlisted',
      'Resume Generated',
      'Application Prepared',
      'Email Sent',
      'Applied',
      'HR Responded',
      'Interview Scheduled',
      'Rejected',
      'Follow-up Due',
      'Withdrawn'
    )
  ),
  application_method TEXT NOT NULL DEFAULT 'portal',
  recipient_email TEXT NOT NULL DEFAULT '',
  email_subject TEXT NOT NULL DEFAULT '',
  sent_at TIMESTAMP,
  application_url TEXT NOT NULL DEFAULT '',
  follow_up_date TIMESTAMP,
  last_response_at TIMESTAMP,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- K. Email Messages (Metadata only)
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  email_provider TEXT NOT NULL DEFAULT 'gmail',
  external_message_id TEXT NOT NULL DEFAULT '',
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'outbound',
  message_status TEXT NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMP,
  received_at TIMESTAMP,
  classification TEXT NOT NULL DEFAULT 'application',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- L. Automation Runs
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  automation_type TEXT NOT NULL DEFAULT 'daily_job_match',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  execution_status TEXT NOT NULL DEFAULT 'running' CHECK (execution_status IN ('running', 'completed', 'partial', 'failed')),
  jobs_discovered INTEGER NOT NULL DEFAULT 0 CHECK (jobs_discovered >= 0),
  jobs_matched INTEGER NOT NULL DEFAULT 0 CHECK (jobs_matched >= 0),
  resumes_generated INTEGER NOT NULL DEFAULT 0 CHECK (resumes_generated >= 0),
  applications_sent INTEGER NOT NULL DEFAULT 0 CHECK (applications_sent >= 0),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- M. Job Preferences
CREATE TABLE IF NOT EXISTS job_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  target_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_work_modes JSONB NOT NULL DEFAULT '[]'::jsonb,
  employment_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  minimum_experience INTEGER NOT NULL DEFAULT 0 CHECK (minimum_experience >= 0),
  maximum_experience INTEGER NOT NULL DEFAULT 15 CHECK (maximum_experience >= 0),
  minimum_salary TEXT NOT NULL DEFAULT '',
  maximum_salary TEXT NOT NULL DEFAULT '',
  minimum_ats_score INTEGER NOT NULL DEFAULT 75 CHECK (minimum_ats_score >= 0 AND minimum_ats_score <= 100),
  daily_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  daily_search_time TEXT NOT NULL DEFAULT '09:00',
  daily_email_limit INTEGER NOT NULL DEFAULT 5 CHECK (daily_email_limit >= 0 AND daily_email_limit <= 50),
  auto_apply_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_companies JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- N. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
