-- Migration 002: Performance Indexes, Row Level Security (RLS) Policies & Private Storage Policies

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_candidate_documents_user_id ON candidate_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_user_id ON job_descriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_company ON job_descriptions(company_name);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_title ON job_descriptions(job_title);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_created_at ON job_descriptions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_resumes_user_id ON generated_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_resumes_jd_id ON generated_resumes(job_description_id);
CREATE INDEX IF NOT EXISTS idx_generated_resumes_created_at ON generated_resumes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ats_analysis_user_id ON ats_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_ats_analysis_jd_id ON ats_analysis(job_description_id);
CREATE INDEX IF NOT EXISTS idx_ats_analysis_resume_id ON ats_analysis(generated_resume_id);
CREATE INDEX IF NOT EXISTS idx_ats_analysis_created_at ON ats_analysis(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_company_name ON jobs(company_name);
CREATE INDEX IF NOT EXISTS idx_jobs_job_title ON jobs(job_title);
CREATE INDEX IF NOT EXISTS idx_jobs_posting_date ON jobs(posting_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recruiters_user_id ON recruiters(user_id);
CREATE INDEX IF NOT EXISTS idx_recruiters_company_name ON recruiters(company_name);
CREATE INDEX IF NOT EXISTS idx_recruiters_verification_status ON recruiters(verification_status);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_resume_id ON applications(generated_resume_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(application_status);
CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_name);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_application_id ON email_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON email_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_runs_user_id ON automation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_created_at ON automation_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Row Level Security (RLS) Policy Specification
-- Enforced in PostgreSQL using app.current_user_id (or Supabase auth.uid() when deployed to Supabase)
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_templates ENABLE ROW LEVEL SECURITY;

-- Owner-scoped policies
CREATE POLICY candidate_profiles_owner ON candidate_profiles
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY candidate_documents_owner ON candidate_documents
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY job_descriptions_owner ON job_descriptions
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY generated_resumes_owner ON generated_resumes
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY ats_analysis_owner ON ats_analysis
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY recruiters_owner ON recruiters
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY applications_owner ON applications
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY email_messages_owner ON email_messages
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY automation_runs_owner ON automation_runs
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY job_preferences_owner ON job_preferences
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

CREATE POLICY audit_logs_owner ON audit_logs
  USING (user_id::text = current_setting('app.current_user_id', true))
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- Shared resume templates: readable by authenticated users, writable by admins only
CREATE POLICY resume_templates_read ON resume_templates
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY resume_templates_admin_write ON resume_templates
  FOR ALL USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
