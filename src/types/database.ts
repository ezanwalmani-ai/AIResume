import type {
  AtsClassification,
  CertificationRecord,
  EducationRecord,
  EmploymentRecord,
  LanguageRecord,
  ResumeTemplateId,
  TemplateCategory,
  TemplateCustomization,
} from './resume.ts';

export const APPLICATION_STATUSES = [
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
  'Withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface CandidateProfileRecord {
  id: string;
  userId: number;
  professionalSummary: string;
  totalExperience: string;
  currentLocation: string;
  preferredLocations: string[];
  preferredJobTitles: string[];
  preferredSalary: string;
  noticePeriod: string;
  joiningAvailability: string;
  education: EducationRecord[];
  certifications: CertificationRecord[];
  languages: LanguageRecord[];
  technicalSkills: string[];
  softwareSkills: string[];
  employmentHistory: EmploymentRecord[];
  achievements: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CandidateDocumentRecord {
  id: string;
  userId: number;
  documentName: string;
  documentType: string;
  storagePath: string;
  fileFormat: string;
  fileSize: number;
  isMasterResume: boolean;
  extractedText: string;
  uploadedAt: string;
}

export interface JobDescriptionDbRecord {
  id: string;
  userId: number;
  companyName: string;
  jobTitle: string;
  jobLocation: string;
  jobDescription: string;
  jobUrl: string;
  employmentType: string;
  experienceRequired: string;
  salaryRange: string;
  requiredSkills: string[];
  preferredSkills: string[];
  requiredKeywords: string[];
  jobSource: string;
  createdAt: string;
}

export interface ResumeTemplateDbRecord {
  id: string;
  slug: ResumeTemplateId;
  templateName: string;
  templateCategory: TemplateCategory;
  templateDescription: string;
  templatePreviewPath: string;
  atsClassification: AtsClassification;
  layoutType: TemplateCustomization['layout'];
  designConfiguration: TemplateCustomization;
  isActive: boolean;
  createdAt: string;
}

export interface JobListingRecord {
  id: string;
  companyName: string;
  jobTitle: string;
  location: string;
  jobDescription: string;
  jobUrl: string;
  dedupeKey: string;
  source: string;
  employmentType: string;
  experienceRequired: string;
  salaryRange: string;
  postingDate: string | null;
  expiryDate: string | null;
  status: 'active' | 'expired' | 'closed' | 'archived';
  createdAt: string;
}

export interface RecruiterRecord {
  id: string;
  userId: number;
  companyName: string;
  recruiterName: string;
  designation: string;
  professionalEmail: string;
  linkedinUrl: string;
  contactSource: string;
  verificationStatus: 'verified' | 'unverified' | 'bounced';
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRecord {
  id: string;
  userId: number;
  jobId: string | null;
  recruiterId: string | null;
  generatedResumeId: number | null;
  companyName: string;
  jobTitle: string;
  applicationStatus: ApplicationStatus;
  applicationMethod: string;
  recipientEmail: string;
  emailSubject: string;
  sentAt: string | null;
  applicationUrl: string;
  followUpDate: string | null;
  lastResponseAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessageRecord {
  id: string;
  userId: number;
  applicationId: string;
  emailProvider: string;
  externalMessageId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  messageType: string;
  messageStatus: string;
  sentAt: string | null;
  receivedAt: string | null;
  classification: string;
  createdAt: string;
}

export interface AutomationRunRecord {
  id: string;
  userId: number;
  automationType: string;
  startedAt: string;
  completedAt: string | null;
  executionStatus: 'running' | 'completed' | 'partial' | 'failed';
  jobsDiscovered: number;
  jobsMatched: number;
  resumesGenerated: number;
  applicationsSent: number;
  errors: string[];
  executionSummary: string;
  createdAt: string;
}

export interface JobPreferencesRecord {
  id: string;
  userId: number;
  targetRoles: string[];
  preferredLocations: string[];
  preferredWorkModes: string[];
  employmentTypes: string[];
  minimumExperience: number;
  maximumExperience: number;
  minimumSalary: string;
  maximumSalary: string;
  minimumAtsScore: number;
  dailySearchEnabled: boolean;
  dailySearchTime: string;
  dailyEmailLimit: number;
  autoApplyEnabled: boolean;
  excludedCompanies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  userId: number;
  actionType: string;
  entityType: string;
  entityId: string;
  actionDetails: Record<string, unknown>;
  createdAt: string;
}

export interface AdminOverviewStats {
  totalUsers: number;
  totalUploadedDocuments: number;
  totalGeneratedResumes: number;
  totalJobDescriptions: number;
  totalDiscoveredJobs: number;
  totalApplications: number;
  totalEmailsSent: number;
  totalTemplates: number;
  databaseSizeBytes: number;
  privateStorageBytes: number;
  latestAutomationRuns: AutomationRunRecord[];
  recentAuditLogs: AuditLogRecord[];
}
