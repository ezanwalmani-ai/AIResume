import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  AtsAnalysisResult,
  AtsClassification,
  CertificationRecord,
  EducationRecord,
  EmploymentRecord,
  FactualVerificationResult,
  GenerationMode,
  JobDescriptionAnalysis,
  LanguageRecord,
  MasterResumeData,
  ResumeTemplateId,
  ReviewerReport,
  TailoredResumeContent,
  TemplateCategory,
  TemplateCustomization,
} from '../types/resume.ts';
import type { ApplicationStatus } from '../types/database.ts';

// ---------------------------------------------------------------------------
// A. USERS (Linked to Firebase Auth UID)
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uuid: uuid('uuid').defaultRandom().notNull(),
    uid: text('uid').notNull().unique(),
    fullName: text('full_name'),
    displayName: text('display_name'),
    email: text('email').notNull(),
    phone: text('phone'),
    role: text('role').$type<'user' | 'admin'>().notNull().default('user'),
    defaultMode: text('default_mode').$type<GenerationMode>().notNull().default('balanced'),
    defaultTemplate: text('default_template')
      .$type<ResumeTemplateId>()
      .notNull()
      .default('classic_professional'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    check('users_role_check', sql`${table.role} IN ('user', 'admin')`),
    check(
      'users_default_mode_check',
      sql`${table.defaultMode} IN ('balanced', 'maximum_alignment', 'conservative')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// PERMANENT MASTER RESUME VAULT (Immutable source of verified truth)
// ---------------------------------------------------------------------------
export const masterResumes = pgTable('master_resumes', {
  id: serial('id').primaryKey(),
  uuid: uuid('uuid').defaultRandom().notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  originalFileName: text('original_file_name'),
  originalMimeType: text('original_mime_type'),
  fileSizeBytes: integer('file_size_bytes'),
  structuredData: jsonb('structured_data').$type<MasterResumeData>().notNull(),
  isApproved: boolean('is_approved').notNull().default(false),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// B. CANDIDATE PROFILES (1:1 per user)
// ---------------------------------------------------------------------------
export const candidateProfiles = pgTable(
  'candidate_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    professionalSummary: text('professional_summary').notNull().default(''),
    totalExperience: text('total_experience').notNull().default(''),
    currentLocation: text('current_location').notNull().default(''),
    preferredLocations: jsonb('preferred_locations').$type<string[]>().notNull().default([]),
    preferredJobTitles: jsonb('preferred_job_titles').$type<string[]>().notNull().default([]),
    preferredSalary: text('preferred_salary').notNull().default(''),
    noticePeriod: text('notice_period').notNull().default(''),
    joiningAvailability: text('joining_availability').notNull().default(''),
    education: jsonb('education').$type<EducationRecord[]>().notNull().default([]),
    certifications: jsonb('certifications').$type<CertificationRecord[]>().notNull().default([]),
    languages: jsonb('languages').$type<LanguageRecord[]>().notNull().default([]),
    technicalSkills: jsonb('technical_skills').$type<string[]>().notNull().default([]),
    softwareSkills: jsonb('software_skills').$type<string[]>().notNull().default([]),
    employmentHistory: jsonb('employment_history')
      .$type<EmploymentRecord[]>()
      .notNull()
      .default([]),
    achievements: jsonb('achievements').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('idx_candidate_profiles_user_id').on(table.userId)],
);

// ---------------------------------------------------------------------------
// C. CANDIDATE DOCUMENTS (Uploaded files metadata; bytes in private storage)
// ---------------------------------------------------------------------------
export const candidateDocuments = pgTable(
  'candidate_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    documentName: text('document_name').notNull(),
    documentType: text('document_type').notNull().default('resume'),
    storagePath: text('storage_path').notNull(),
    fileFormat: text('file_format').notNull(),
    fileSize: integer('file_size').notNull().default(0),
    isMasterResume: boolean('is_master_resume').notNull().default(false),
    extractedText: text('extracted_text').notNull().default(''),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_candidate_documents_user_id').on(table.userId),
    check('candidate_documents_file_size_check', sql`${table.fileSize} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// D. JOB DESCRIPTIONS
// ---------------------------------------------------------------------------
export const jobDescriptions = pgTable(
  'job_descriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    companyName: text('company_name').notNull(),
    jobTitle: text('job_title').notNull(),
    jobLocation: text('job_location').notNull().default(''),
    jobDescription: text('job_description').notNull(),
    jobUrl: text('job_url').notNull().default(''),
    employmentType: text('employment_type').notNull().default(''),
    experienceRequired: text('experience_required').notNull().default(''),
    salaryRange: text('salary_range').notNull().default(''),
    requiredSkills: jsonb('required_skills').$type<string[]>().notNull().default([]),
    preferredSkills: jsonb('preferred_skills').$type<string[]>().notNull().default([]),
    requiredKeywords: jsonb('required_keywords').$type<string[]>().notNull().default([]),
    jobSource: text('job_source').notNull().default('manual_paste'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_job_descriptions_user_id').on(table.userId),
    index('idx_job_descriptions_company_name').on(table.companyName),
    index('idx_job_descriptions_job_title').on(table.jobTitle),
    index('idx_job_descriptions_created_at').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// E. SHARED RESUME TEMPLATES (Reusable across users)
// ---------------------------------------------------------------------------
export const resumeTemplates = pgTable('resume_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').$type<ResumeTemplateId>().notNull().unique(),
  templateName: text('template_name').notNull(),
  templateCategory: text('template_category').$type<TemplateCategory>().notNull(),
  templateDescription: text('template_description').notNull(),
  templatePreviewPath: text('template_preview_path').notNull().default(''),
  atsClassification: text('ats_classification').$type<AtsClassification>().notNull(),
  layoutType: text('layout_type').$type<TemplateCustomization['layout']>().notNull(),
  designConfiguration: jsonb('design_configuration').$type<TemplateCustomization>().notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// F. GENERATED RESUMES
// ---------------------------------------------------------------------------
export const generatedResumes = pgTable(
  'generated_resumes',
  {
    id: serial('id').primaryKey(),
    uuid: uuid('uuid').defaultRandom().notNull(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    masterResumeId: integer('master_resume_id').references(() => masterResumes.id, {
      onDelete: 'set null',
    }),
    jobDescriptionId: uuid('job_description_id').references(() => jobDescriptions.id, {
      onDelete: 'set null',
    }),
    originalDocumentId: uuid('original_document_id').references(() => candidateDocuments.id, {
      onDelete: 'set null',
    }),
    resumeTemplateUuid: uuid('resume_template_uuid').references(() => resumeTemplates.id, {
      onDelete: 'set null',
    }),
    resumeTitle: text('resume_title').notNull().default(''),
    jobTitle: text('job_title').notNull(),
    companyName: text('company_name').notNull(),
    originalJd: text('original_jd').notNull(),
    jdAnalysis: jsonb('jd_analysis').$type<JobDescriptionAnalysis>().notNull(),
    generationMode: text('generation_mode').$type<GenerationMode>().notNull(),
    templateId: text('template_id')
      .$type<ResumeTemplateId>()
      .notNull()
      .default('classic_professional'),
    templateCustomization: jsonb('template_customization').$type<TemplateCustomization | null>(),
    tailoredResume: jsonb('tailored_resume').$type<TailoredResumeContent>().notNull(),
    generatedText: text('generated_text').notNull().default(''),
    pdfStoragePath: text('pdf_storage_path').notNull().default(''),
    docxStoragePath: text('docx_storage_path').notNull().default(''),
    originalAtsScore: integer('original_ats_score'),
    finalAtsScore: integer('final_ats_score'),
    keywordMatchScore: integer('keyword_match_score'),
    skillsMatchScore: integer('skills_match_score'),
    experienceMatchScore: integer('experience_match_score'),
    formattingScore: integer('formatting_score'),
    missingKeywords: jsonb('missing_keywords').$type<string[]>().notNull().default([]),
    improvementNotes: jsonb('improvement_notes').$type<string[]>().notNull().default([]),
    generationStatus: text('generation_status')
      .$type<'pending' | 'processing' | 'completed' | 'failed'>()
      .notNull()
      .default('completed'),
    atsAnalysis: jsonb('ats_analysis').$type<AtsAnalysisResult>().notNull(),
    factualVerification: jsonb('factual_verification').$type<FactualVerificationResult>().notNull(),
    reviewReport: jsonb('review_report').$type<ReviewerReport>().notNull(),
    aiModel: text('ai_model').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_generated_resumes_user_id').on(table.userId),
    index('idx_generated_resumes_job_description_id').on(table.jobDescriptionId),
    index('idx_generated_resumes_created_at').on(table.createdAt),
    check(
      'generated_resumes_orig_score_check',
      sql`${table.originalAtsScore} IS NULL OR (${table.originalAtsScore} >= 0 AND ${table.originalAtsScore} <= 100)`,
    ),
    check(
      'generated_resumes_final_score_check',
      sql`${table.finalAtsScore} IS NULL OR (${table.finalAtsScore} >= 0 AND ${table.finalAtsScore} <= 100)`,
    ),
    check(
      'generated_resumes_status_check',
      sql`${table.generationStatus} IN ('pending', 'processing', 'completed', 'failed')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// G. ATS ANALYSIS
// ---------------------------------------------------------------------------
export const atsAnalysis = pgTable(
  'ats_analysis',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    jobDescriptionId: uuid('job_description_id').references(() => jobDescriptions.id, {
      onDelete: 'set null',
    }),
    generatedResumeId: integer('generated_resume_id')
      .references(() => generatedResumes.id, { onDelete: 'cascade' })
      .notNull(),
    originalScore: integer('original_score').notNull().default(0),
    finalScore: integer('final_score').notNull().default(0),
    requiredKeywordMatches: jsonb('required_keyword_matches').$type<string[]>().notNull().default([]),
    missingRequiredKeywords: jsonb('missing_required_keywords')
      .$type<string[]>()
      .notNull()
      .default([]),
    preferredKeywordMatches: jsonb('preferred_keyword_matches')
      .$type<string[]>()
      .notNull()
      .default([]),
    skillsMatch: jsonb('skills_match')
      .$type<{ skillsMatchPercentage: number; transferableSkills: string[] }>()
      .notNull()
      .default({ skillsMatchPercentage: 0, transferableSkills: [] }),
    experienceAlignment: jsonb('experience_alignment').$type<string[]>().notNull().default([]),
    formattingIssues: jsonb('formatting_issues').$type<string[]>().notNull().default([]),
    improvementRecommendations: jsonb('improvement_recommendations')
      .$type<string[]>()
      .notNull()
      .default([]),
    analysisDetails: jsonb('analysis_details').$type<AtsAnalysisResult>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ats_analysis_user_id').on(table.userId),
    index('idx_ats_analysis_job_description_id').on(table.jobDescriptionId),
    index('idx_ats_analysis_generated_resume_id').on(table.generatedResumeId),
    index('idx_ats_analysis_created_at').on(table.createdAt),
    check(
      'ats_analysis_orig_score_check',
      sql`${table.originalScore} >= 0 AND ${table.originalScore} <= 100`,
    ),
    check(
      'ats_analysis_final_score_check',
      sql`${table.finalScore} >= 0 AND ${table.finalScore} <= 100`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// H. DISCOVERED / TRACKED JOBS (Deduplicated)
// ---------------------------------------------------------------------------
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyName: text('company_name').notNull(),
    jobTitle: text('job_title').notNull(),
    location: text('location').notNull().default(''),
    jobDescription: text('job_description').notNull(),
    jobUrl: text('job_url').notNull().default(''),
    dedupeKey: text('dedupe_key').notNull().unique(),
    source: text('source').notNull().default('manual'),
    employmentType: text('employment_type').notNull().default(''),
    experienceRequired: text('experience_required').notNull().default(''),
    salaryRange: text('salary_range').notNull().default(''),
    postingDate: timestamp('posting_date'),
    expiryDate: timestamp('expiry_date'),
    status: text('status')
      .$type<'active' | 'expired' | 'closed' | 'archived'>()
      .notNull()
      .default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_jobs_company_name').on(table.companyName),
    index('idx_jobs_job_title').on(table.jobTitle),
    index('idx_jobs_posting_date').on(table.postingDate),
    index('idx_jobs_created_at').on(table.createdAt),
    check('jobs_status_check', sql`${table.status} IN ('active', 'expired', 'closed', 'archived')`),
  ],
);

// ---------------------------------------------------------------------------
// I. VERIFIED RECRUITERS
// ---------------------------------------------------------------------------
export const recruiters = pgTable(
  'recruiters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    companyName: text('company_name').notNull(),
    recruiterName: text('recruiter_name').notNull(),
    designation: text('designation').notNull().default(''),
    professionalEmail: text('professional_email').notNull().default(''),
    linkedinUrl: text('linkedin_url').notNull().default(''),
    contactSource: text('contact_source').notNull().default('user_provided'),
    verificationStatus: text('verification_status')
      .$type<'verified' | 'unverified' | 'bounced'>()
      .notNull()
      .default('unverified'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_recruiters_user_id').on(table.userId),
    index('idx_recruiters_company_name').on(table.companyName),
    index('idx_recruiters_verification_status').on(table.verificationStatus),
    check(
      'recruiters_verification_check',
      sql`${table.verificationStatus} IN ('verified', 'unverified', 'bounced')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// J. APPLICATIONS
// ---------------------------------------------------------------------------
export const applications = pgTable(
  'applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    recruiterId: uuid('recruiter_id').references(() => recruiters.id, { onDelete: 'set null' }),
    generatedResumeId: integer('generated_resume_id').references(() => generatedResumes.id, {
      onDelete: 'set null',
    }),
    companyName: text('company_name').notNull(),
    jobTitle: text('job_title').notNull(),
    applicationStatus: text('application_status')
      .$type<ApplicationStatus>()
      .notNull()
      .default('Resume Generated'),
    applicationMethod: text('application_method').notNull().default('portal'),
    recipientEmail: text('recipient_email').notNull().default(''),
    emailSubject: text('email_subject').notNull().default(''),
    sentAt: timestamp('sent_at'),
    applicationUrl: text('application_url').notNull().default(''),
    followUpDate: timestamp('follow_up_date'),
    lastResponseAt: timestamp('last_response_at'),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_applications_user_id').on(table.userId),
    index('idx_applications_job_id').on(table.jobId),
    index('idx_applications_generated_resume_id').on(table.generatedResumeId),
    index('idx_applications_status').on(table.applicationStatus),
    index('idx_applications_company_name').on(table.companyName),
    index('idx_applications_job_title').on(table.jobTitle),
    index('idx_applications_created_at').on(table.createdAt),
    check(
      'applications_status_check',
      sql`${table.applicationStatus} IN (
        'Discovered', 'Matched', 'Shortlisted', 'Resume Generated',
        'Application Prepared', 'Email Sent', 'Applied', 'HR Responded',
        'Interview Scheduled', 'Rejected', 'Follow-up Due', 'Withdrawn'
      )`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// K. EMAIL MESSAGES (Activity Metadata Only)
// ---------------------------------------------------------------------------
export const emailMessages = pgTable(
  'email_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    applicationId: uuid('application_id')
      .references(() => applications.id, { onDelete: 'cascade' })
      .notNull(),
    emailProvider: text('email_provider').notNull().default('gmail'),
    externalMessageId: text('external_message_id').notNull().default(''),
    senderEmail: text('sender_email').notNull(),
    recipientEmail: text('recipient_email').notNull(),
    subject: text('subject').notNull(),
    messageType: text('message_type').notNull().default('outbound'),
    messageStatus: text('message_status').notNull().default('sent'),
    sentAt: timestamp('sent_at'),
    receivedAt: timestamp('received_at'),
    classification: text('classification').notNull().default('application'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_email_messages_user_id').on(table.userId),
    index('idx_email_messages_application_id').on(table.applicationId),
    index('idx_email_messages_created_at').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// L. AUTOMATION RUNS
// ---------------------------------------------------------------------------
export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    automationType: text('automation_type').notNull().default('daily_job_match'),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    executionStatus: text('execution_status')
      .$type<'running' | 'completed' | 'partial' | 'failed'>()
      .notNull()
      .default('running'),
    jobsDiscovered: integer('jobs_discovered').notNull().default(0),
    jobsMatched: integer('jobs_matched').notNull().default(0),
    resumesGenerated: integer('resumes_generated').notNull().default(0),
    applicationsSent: integer('applications_sent').notNull().default(0),
    errors: jsonb('errors').$type<string[]>().notNull().default([]),
    executionSummary: text('execution_summary').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_automation_runs_user_id').on(table.userId),
    index('idx_automation_runs_created_at').on(table.createdAt),
    check(
      'automation_runs_status_check',
      sql`${table.executionStatus} IN ('running', 'completed', 'partial', 'failed')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// M. JOB PREFERENCES (1:1 per user)
// ---------------------------------------------------------------------------
export const jobPreferences = pgTable(
  'job_preferences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    targetRoles: jsonb('target_roles').$type<string[]>().notNull().default([]),
    preferredLocations: jsonb('preferred_locations').$type<string[]>().notNull().default([]),
    preferredWorkModes: jsonb('preferred_work_modes').$type<string[]>().notNull().default([]),
    employmentTypes: jsonb('employment_types').$type<string[]>().notNull().default([]),
    minimumExperience: integer('minimum_experience').notNull().default(0),
    maximumExperience: integer('maximum_experience').notNull().default(15),
    minimumSalary: text('minimum_salary').notNull().default(''),
    maximumSalary: text('maximum_salary').notNull().default(''),
    minimumAtsScore: integer('minimum_ats_score').notNull().default(75),
    dailySearchEnabled: boolean('daily_search_enabled').notNull().default(false),
    dailySearchTime: text('daily_search_time').notNull().default('09:00'),
    dailyEmailLimit: integer('daily_email_limit').notNull().default(5),
    autoApplyEnabled: boolean('auto_apply_enabled').notNull().default(false),
    excludedCompanies: jsonb('excluded_companies').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_job_preferences_user_id').on(table.userId),
    check(
      'job_preferences_min_ats_check',
      sql`${table.minimumAtsScore} >= 0 AND ${table.minimumAtsScore} <= 100`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// N. AUDIT LOGS
// ---------------------------------------------------------------------------
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    actionType: text('action_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    actionDetails: jsonb('action_details')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_logs_user_id').on(table.userId),
    index('idx_audit_logs_created_at').on(table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// DRIZZLE RELATIONS
// ---------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  masterResume: one(masterResumes, {
    fields: [users.id],
    references: [masterResumes.userId],
  }),
  candidateProfile: one(candidateProfiles, {
    fields: [users.id],
    references: [candidateProfiles.userId],
  }),
  jobPreferences: one(jobPreferences, {
    fields: [users.id],
    references: [jobPreferences.userId],
  }),
  candidateDocuments: many(candidateDocuments),
  jobDescriptions: many(jobDescriptions),
  generatedResumes: many(generatedResumes),
  atsAnalyses: many(atsAnalysis),
  recruiters: many(recruiters),
  applications: many(applications),
  emailMessages: many(emailMessages),
  automationRuns: many(automationRuns),
  auditLogs: many(auditLogs),
}));

export const masterResumesRelations = relations(masterResumes, ({ one, many }) => ({
  user: one(users, {
    fields: [masterResumes.userId],
    references: [users.id],
  }),
  generatedVersions: many(generatedResumes),
}));

export const candidateProfilesRelations = relations(candidateProfiles, ({ one }) => ({
  user: one(users, {
    fields: [candidateProfiles.userId],
    references: [users.id],
  }),
}));

export const candidateDocumentsRelations = relations(candidateDocuments, ({ one }) => ({
  user: one(users, {
    fields: [candidateDocuments.userId],
    references: [users.id],
  }),
}));

export const jobDescriptionsRelations = relations(jobDescriptions, ({ one, many }) => ({
  user: one(users, {
    fields: [jobDescriptions.userId],
    references: [users.id],
  }),
  generatedResumes: many(generatedResumes),
  atsAnalyses: many(atsAnalysis),
}));

export const resumeTemplatesRelations = relations(resumeTemplates, ({ many }) => ({
  generatedResumes: many(generatedResumes),
}));

export const generatedResumesRelations = relations(generatedResumes, ({ one, many }) => ({
  user: one(users, {
    fields: [generatedResumes.userId],
    references: [users.id],
  }),
  masterResume: one(masterResumes, {
    fields: [generatedResumes.masterResumeId],
    references: [masterResumes.id],
  }),
  jobDescription: one(jobDescriptions, {
    fields: [generatedResumes.jobDescriptionId],
    references: [jobDescriptions.id],
  }),
  originalDocument: one(candidateDocuments, {
    fields: [generatedResumes.originalDocumentId],
    references: [candidateDocuments.id],
  }),
  resumeTemplate: one(resumeTemplates, {
    fields: [generatedResumes.resumeTemplateUuid],
    references: [resumeTemplates.id],
  }),
  atsAnalyses: many(atsAnalysis),
  applications: many(applications),
}));

export const atsAnalysisRelations = relations(atsAnalysis, ({ one }) => ({
  user: one(users, {
    fields: [atsAnalysis.userId],
    references: [users.id],
  }),
  jobDescription: one(jobDescriptions, {
    fields: [atsAnalysis.jobDescriptionId],
    references: [jobDescriptions.id],
  }),
  generatedResume: one(generatedResumes, {
    fields: [atsAnalysis.generatedResumeId],
    references: [generatedResumes.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
  applications: many(applications),
}));

export const recruitersRelations = relations(recruiters, ({ one, many }) => ({
  user: one(users, {
    fields: [recruiters.userId],
    references: [users.id],
  }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, {
    fields: [applications.userId],
    references: [users.id],
  }),
  job: one(jobs, {
    fields: [applications.jobId],
    references: [jobs.id],
  }),
  recruiter: one(recruiters, {
    fields: [applications.recruiterId],
    references: [recruiters.id],
  }),
  generatedResume: one(generatedResumes, {
    fields: [applications.generatedResumeId],
    references: [generatedResumes.id],
  }),
  emailMessages: many(emailMessages),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  user: one(users, {
    fields: [emailMessages.userId],
    references: [users.id],
  }),
  application: one(applications, {
    fields: [emailMessages.applicationId],
    references: [applications.id],
  }),
}));

export const automationRunsRelations = relations(automationRuns, ({ one }) => ({
  user: one(users, {
    fields: [automationRuns.userId],
    references: [users.id],
  }),
}));

export const jobPreferencesRelations = relations(jobPreferences, ({ one }) => ({
  user: one(users, {
    fields: [jobPreferences.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
