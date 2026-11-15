import crypto from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  applications,
  auditLogs,
  automationRuns,
  candidateDocuments,
  candidateProfiles,
  emailMessages,
  generatedResumes,
  jobDescriptions,
  jobPreferences,
  jobs,
  recruiters,
  resumeTemplates,
  users,
} from './schema.ts';
import { getPrivateStorageTotalBytes } from '../server/storage.ts';
import type { MasterResumeData } from '../types/resume.ts';
import type {
  AdminOverviewStats,
  ApplicationStatus,
} from '../types/database.ts';

// ---------------------------------------------------------------------------
// AUDIT LOGS
// ---------------------------------------------------------------------------

export async function recordAuditLog(params: {
  userId: number;
  actionType: string;
  entityType: string;
  entityId: string;
  actionDetails?: Record<string, unknown>;
}) {
  try {
    const inserted = await db
      .insert(auditLogs)
      .values({
        userId: params.userId,
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        actionDetails: params.actionDetails ?? {},
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in recordAuditLog:', error);
    throw new Error('Failed to write audit log.', { cause: error });
  }
}

export async function listAuditLogsByUserId(userId: number, limit = 50) {
  try {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Database query failed in listAuditLogsByUserId:', error);
    throw new Error('Failed to load audit logs.', { cause: error });
  }
}

// ---------------------------------------------------------------------------
// CANDIDATE PROFILES (1:1 per user)
// ---------------------------------------------------------------------------

export async function getCandidateProfileByUserId(userId: number) {
  try {
    const rows = await db
      .select()
      .from(candidateProfiles)
      .where(eq(candidateProfiles.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getCandidateProfileByUserId:', error);
    throw new Error('Failed to load candidate profile.', { cause: error });
  }
}

export async function upsertCandidateProfile(
  userId: number,
  data: Partial<{
    professionalSummary: string;
    totalExperience: string;
    currentLocation: string;
    preferredLocations: string[];
    preferredJobTitles: string[];
    preferredSalary: string;
    noticePeriod: string;
    joiningAvailability: string;
    education: MasterResumeData['education'];
    certifications: MasterResumeData['certifications'];
    languages: MasterResumeData['languages'];
    technicalSkills: string[];
    softwareSkills: string[];
    employmentHistory: MasterResumeData['employmentHistory'];
    achievements: string[];
  }>,
) {
  try {
    const existing = await getCandidateProfileByUserId(userId);
    if (existing) {
      const updated = await db
        .update(candidateProfiles)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(candidateProfiles.userId, userId))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(candidateProfiles)
      .values({
        userId,
        professionalSummary: data.professionalSummary ?? '',
        totalExperience: data.totalExperience ?? '',
        currentLocation: data.currentLocation ?? '',
        preferredLocations: data.preferredLocations ?? [],
        preferredJobTitles: data.preferredJobTitles ?? [],
        preferredSalary: data.preferredSalary ?? '',
        noticePeriod: data.noticePeriod ?? '',
        joiningAvailability: data.joiningAvailability ?? '',
        education: data.education ?? [],
        certifications: data.certifications ?? [],
        languages: data.languages ?? [],
        technicalSkills: data.technicalSkills ?? [],
        softwareSkills: data.softwareSkills ?? [],
        employmentHistory: data.employmentHistory ?? [],
        achievements: data.achievements ?? [],
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in upsertCandidateProfile:', error);
    throw new Error('Failed to save candidate profile.', { cause: error });
  }
}

export async function syncCandidateProfileFromMasterData(
  userId: number,
  masterData: MasterResumeData,
) {
  const achievements = masterData.employmentHistory.flatMap((e) => e.achievements);
  return upsertCandidateProfile(userId, {
    professionalSummary: masterData.professionalSummary,
    currentLocation: masterData.personalInfo.location || '',
    preferredJobTitles: masterData.headline ? [masterData.headline] : [],
    education: masterData.education,
    certifications: masterData.certifications,
    languages: masterData.languages,
    technicalSkills: masterData.technicalSkills,
    softwareSkills: masterData.erpKnowledge,
    employmentHistory: masterData.employmentHistory,
    achievements,
  });
}

// ---------------------------------------------------------------------------
// CANDIDATE DOCUMENTS
// ---------------------------------------------------------------------------

export async function createCandidateDocument(params: {
  userId: number;
  documentName: string;
  documentType?: string;
  storagePath: string;
  fileFormat: string;
  fileSize: number;
  isMasterResume: boolean;
  extractedText: string;
}) {
  try {
    if (params.isMasterResume) {
      await db
        .update(candidateDocuments)
        .set({ isMasterResume: false })
        .where(eq(candidateDocuments.userId, params.userId));
    }

    const inserted = await db
      .insert(candidateDocuments)
      .values({
        userId: params.userId,
        documentName: params.documentName,
        documentType: params.documentType ?? 'resume',
        storagePath: params.storagePath,
        fileFormat: params.fileFormat,
        fileSize: params.fileSize,
        isMasterResume: params.isMasterResume,
        extractedText: params.extractedText,
      })
      .returning();

    await recordAuditLog({
      userId: params.userId,
      actionType: 'DOCUMENT_UPLOADED',
      entityType: 'candidate_documents',
      entityId: inserted[0].id,
      actionDetails: {
        documentName: params.documentName,
        fileFormat: params.fileFormat,
        isMasterResume: params.isMasterResume,
      },
    });

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createCandidateDocument:', error);
    throw new Error('Failed to save document metadata.', { cause: error });
  }
}

export async function listCandidateDocumentsByUserId(userId: number) {
  try {
    return await db
      .select()
      .from(candidateDocuments)
      .where(eq(candidateDocuments.userId, userId))
      .orderBy(desc(candidateDocuments.uploadedAt));
  } catch (error) {
    console.error('Database query failed in listCandidateDocumentsByUserId:', error);
    throw new Error('Failed to load candidate documents.', { cause: error });
  }
}

export async function getCandidateDocumentById(id: string, userId: number) {
  try {
    const rows = await db
      .select()
      .from(candidateDocuments)
      .where(and(eq(candidateDocuments.id, id), eq(candidateDocuments.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getCandidateDocumentById:', error);
    throw new Error('Failed to load document.', { cause: error });
  }
}

export async function deleteCandidateDocumentById(id: string, userId: number) {
  try {
    const deleted = await db
      .delete(candidateDocuments)
      .where(and(eq(candidateDocuments.id, id), eq(candidateDocuments.userId, userId)))
      .returning();
    return deleted[0] ?? null;
  } catch (error) {
    console.error('Database query failed in deleteCandidateDocumentById:', error);
    throw new Error('Failed to delete document.', { cause: error });
  }
}

// ---------------------------------------------------------------------------
// DISCOVERED / TRACKED JOBS (Deduplicated)
// ---------------------------------------------------------------------------

export function buildJobDedupeKey(companyName: string, jobTitle: string, jobUrl?: string): string {
  const normalizedUrl = (jobUrl || '').trim().toLowerCase();
  const base = normalizedUrl
    ? normalizedUrl
    : `${companyName.trim().toLowerCase()}|${jobTitle.trim().toLowerCase()}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

export async function upsertJobListing(params: {
  companyName: string;
  jobTitle: string;
  location?: string;
  jobDescription: string;
  jobUrl?: string;
  source?: string;
  employmentType?: string;
  experienceRequired?: string;
  salaryRange?: string;
  postingDate?: Date | null;
  expiryDate?: Date | null;
  status?: 'active' | 'expired' | 'closed' | 'archived';
}) {
  try {
    const dedupeKey = buildJobDedupeKey(params.companyName, params.jobTitle, params.jobUrl);
    const result = await db
      .insert(jobs)
      .values({
        companyName: params.companyName,
        jobTitle: params.jobTitle,
        location: params.location ?? '',
        jobDescription: params.jobDescription,
        jobUrl: params.jobUrl ?? '',
        dedupeKey,
        source: params.source ?? 'manual',
        employmentType: params.employmentType ?? '',
        experienceRequired: params.experienceRequired ?? '',
        salaryRange: params.salaryRange ?? '',
        postingDate: params.postingDate ?? new Date(),
        expiryDate: params.expiryDate ?? null,
        status: params.status ?? 'active',
      })
      .onConflictDoUpdate({
        target: jobs.dedupeKey,
        set: {
          location: params.location ?? '',
          jobDescription: params.jobDescription,
          salaryRange: params.salaryRange ?? '',
          status: params.status ?? 'active',
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in upsertJobListing:', error);
    throw new Error('Failed to save job listing.', { cause: error });
  }
}

export async function listJobListings(limit = 100) {
  try {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit);
  } catch (error) {
    console.error('Database query failed in listJobListings:', error);
    throw new Error('Failed to load job listings.', { cause: error });
  }
}

// ---------------------------------------------------------------------------
// VERIFIED RECRUITERS
// ---------------------------------------------------------------------------

export async function createRecruiterRecord(params: {
  userId: number;
  companyName: string;
  recruiterName: string;
  designation?: string;
  professionalEmail?: string;
  linkedinUrl?: string;
  contactSource?: string;
  verificationStatus?: 'verified' | 'unverified' | 'bounced';
}) {
  try {
    const inserted = await db
      .insert(recruiters)
      .values({
        userId: params.userId,
        companyName: params.companyName,
        recruiterName: params.recruiterName,
        designation: params.designation ?? '',
        professionalEmail: params.professionalEmail ?? '',
        linkedinUrl: params.linkedinUrl ?? '',
        contactSource: params.contactSource ?? 'user_provided',
        verificationStatus: params.verificationStatus ?? 'unverified',
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createRecruiterRecord:', error);
    throw new Error('Failed to save recruiter contact.', { cause: error });
  }
}

export async function listRecruitersByUserId(userId: number) {
  try {
    return await db
      .select()
      .from(recruiters)
      .where(eq(recruiters.userId, userId))
      .orderBy(desc(recruiters.createdAt));
  } catch (error) {
    console.error('Database query failed in listRecruitersByUserId:', error);
    throw new Error('Failed to load recruiter contacts.', { cause: error });
  }
}

export async function updateRecruiterById(
  id: string,
  userId: number,
  updates: Partial<{
    companyName: string;
    recruiterName: string;
    designation: string;
    professionalEmail: string;
    linkedinUrl: string;
    verificationStatus: 'verified' | 'unverified' | 'bounced';
  }>,
) {
  try {
    const updated = await db
      .update(recruiters)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(recruiters.id, id), eq(recruiters.userId, userId)))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateRecruiterById:', error);
    throw new Error('Failed to update recruiter contact.', { cause: error });
  }
}

export async function deleteRecruiterById(id: string, userId: number) {
  try {
    const deleted = await db
      .delete(recruiters)
      .where(and(eq(recruiters.id, id), eq(recruiters.userId, userId)))
      .returning({ id: recruiters.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteRecruiterById:', error);
    throw new Error('Failed to delete recruiter contact.', { cause: error });
  }
}

// ---------------------------------------------------------------------------
// APPLICATIONS & EMAIL ACTIVITY
// ---------------------------------------------------------------------------

export async function createApplicationRecord(params: {
  userId: number;
  jobId?: string | null;
  recruiterId?: string | null;
  generatedResumeId?: number | null;
  companyName: string;
  jobTitle: string;
  applicationStatus?: ApplicationStatus;
  applicationMethod?: string;
  recipientEmail?: string;
  emailSubject?: string;
  applicationUrl?: string;
  followUpDate?: Date | null;
  notes?: string;
}) {
  try {
    const inserted = await db
      .insert(applications)
      .values({
        userId: params.userId,
        jobId: params.jobId ?? null,
        recruiterId: params.recruiterId ?? null,
        generatedResumeId: params.generatedResumeId ?? null,
        companyName: params.companyName,
        jobTitle: params.jobTitle,
        applicationStatus: params.applicationStatus ?? 'Resume Generated',
        applicationMethod: params.applicationMethod ?? 'portal',
        recipientEmail: params.recipientEmail ?? '',
        emailSubject: params.emailSubject ?? '',
        applicationUrl: params.applicationUrl ?? '',
        followUpDate: params.followUpDate ?? null,
        notes: params.notes ?? '',
      })
      .returning();

    await recordAuditLog({
      userId: params.userId,
      actionType: 'APPLICATION_CREATED',
      entityType: 'applications',
      entityId: inserted[0].id,
      actionDetails: {
        companyName: params.companyName,
        jobTitle: params.jobTitle,
        status: inserted[0].applicationStatus,
      },
    });

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createApplicationRecord:', error);
    throw new Error('Failed to create job application.', { cause: error });
  }
}

export async function listApplicationsByUserId(userId: number) {
  try {
    return await db
      .select()
      .from(applications)
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.updatedAt));
  } catch (error) {
    console.error('Database query failed in listApplicationsByUserId:', error);
    throw new Error('Failed to load job applications.', { cause: error });
  }
}

export async function getApplicationById(id: string, userId: number) {
  try {
    const rows = await db
      .select()
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getApplicationById:', error);
    throw new Error('Failed to load job application.', { cause: error });
  }
}

export async function updateApplicationById(
  id: string,
  userId: number,
  updates: Partial<{
    recruiterId: string | null;
    generatedResumeId: number | null;
    applicationStatus: ApplicationStatus;
    applicationMethod: string;
    recipientEmail: string;
    emailSubject: string;
    sentAt: Date | null;
    applicationUrl: string;
    followUpDate: Date | null;
    lastResponseAt: Date | null;
    notes: string;
  }>,
) {
  try {
    const updated = await db
      .update(applications)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(applications.id, id), eq(applications.userId, userId)))
      .returning();

    if (updated[0]) {
      await recordAuditLog({
        userId,
        actionType: 'APPLICATION_UPDATED',
        entityType: 'applications',
        entityId: id,
        actionDetails: {
          status: updated[0].applicationStatus,
        },
      });
    }

    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateApplicationById:', error);
    throw new Error('Failed to update job application.', { cause: error });
  }
}

export async function deleteApplicationById(id: string, userId: number) {
  try {
    const deleted = await db
      .delete(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, userId)))
      .returning({ id: applications.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteApplicationById:', error);
    throw new Error('Failed to delete application.', { cause: error });
  }
}

export async function recordConfirmedEmailMessage(params: {
  userId: number;
  applicationId: string;
  emailProvider?: string;
  externalMessageId?: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  messageType?: string;
  messageStatus?: string;
  classification?: string;
  markApplicationSent?: boolean;
}) {
  try {
    const app = await getApplicationById(params.applicationId, params.userId);
    if (!app) return null;

    const now = new Date();
    const inserted = await db
      .insert(emailMessages)
      .values({
        userId: params.userId,
        applicationId: params.applicationId,
        emailProvider: params.emailProvider ?? 'gmail',
        externalMessageId: params.externalMessageId ?? '',
        senderEmail: params.senderEmail,
        recipientEmail: params.recipientEmail,
        subject: params.subject,
        messageType: params.messageType ?? 'outbound',
        messageStatus: params.messageStatus ?? 'sent',
        sentAt: now,
        classification: params.classification ?? 'application',
      })
      .returning();

    if (params.markApplicationSent !== false) {
      await db
        .update(applications)
        .set({
          applicationStatus: 'Email Sent',
          recipientEmail: params.recipientEmail,
          emailSubject: params.subject,
          sentAt: now,
          updatedAt: now,
        })
        .where(and(eq(applications.id, params.applicationId), eq(applications.userId, params.userId)));
    }

    await recordAuditLog({
      userId: params.userId,
      actionType: 'EMAIL_LOGGED',
      entityType: 'email_messages',
      entityId: inserted[0].id,
      actionDetails: {
        applicationId: params.applicationId,
        recipientEmail: params.recipientEmail,
        provider: params.emailProvider ?? 'gmail',
      },
    });

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in recordConfirmedEmailMessage:', error);
    throw new Error('Failed to record email activity.', { cause: error });
  }
}

export async function listEmailMessagesByUserId(userId: number) {
  try {
    return await db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.userId, userId))
      .orderBy(desc(emailMessages.createdAt));
  } catch (error) {
    console.error('Database query failed in listEmailMessagesByUserId:', error);
    throw new Error('Failed to load email activity.', { cause: error });
  }
}

// ---------------------------------------------------------------------------
// JOB PREFERENCES & AUTOMATION RUNS
// ---------------------------------------------------------------------------

export async function getOrCreateJobPreferences(userId: number) {
  try {
    const existing = await db
      .select()
      .from(jobPreferences)
      .where(eq(jobPreferences.userId, userId))
      .limit(1);
    if (existing[0]) return existing[0];

    const inserted = await db
      .insert(jobPreferences)
      .values({ userId })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateJobPreferences:', error);
    throw new Error('Failed to load job preferences.', { cause: error });
  }
}

export async function upsertJobPreferences(
  userId: number,
  updates: Partial<{
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
  }>,
) {
  try {
    await getOrCreateJobPreferences(userId);
    const updated = await db
      .update(jobPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(jobPreferences.userId, userId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in upsertJobPreferences:', error);
    throw new Error('Failed to save job preferences.', { cause: error });
  }
}

export async function listAutomationRunsByUserId(userId: number) {
  try {
    return await db
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.userId, userId))
      .orderBy(desc(automationRuns.createdAt))
      .limit(30);
  } catch (error) {
    console.error('Database query failed in listAutomationRunsByUserId:', error);
    throw new Error('Failed to load automation runs.', { cause: error });
  }
}

export async function executeUserAutomationRun(userId: number) {
  try {
    const prefs = await getOrCreateJobPreferences(userId);
    const activeJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.status, 'active'))
      .orderBy(desc(jobs.createdAt))
      .limit(50);

    const excludedSet = new Set(prefs.excludedCompanies.map((c) => c.toLowerCase()));
    const targetRolesLower = prefs.targetRoles.map((r) => r.toLowerCase());
    const matched = activeJobs.filter((j) => {
      if (excludedSet.has(j.companyName.toLowerCase())) return false;
      if (targetRolesLower.length === 0) return true;
      const titleLower = j.jobTitle.toLowerCase();
      return targetRolesLower.some((r) => titleLower.includes(r));
    });

    const userResumes = await db
      .select({ id: generatedResumes.id })
      .from(generatedResumes)
      .where(eq(generatedResumes.userId, userId));

    const userEmails = await db
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(eq(emailMessages.userId, userId));

    const inserted = await db
      .insert(automationRuns)
      .values({
        userId,
        automationType: 'daily_job_match',
        startedAt: new Date(),
        completedAt: new Date(),
        executionStatus: 'completed',
        jobsDiscovered: activeJobs.length,
        jobsMatched: matched.length,
        resumesGenerated: userResumes.length,
        applicationsSent: userEmails.length,
        errors: [],
        executionSummary: `Scanned ${activeJobs.length} active job listings against preferences (${prefs.targetRoles.length} target roles); matched ${matched.length} roles.`,
      })
      .returning();

    await recordAuditLog({
      userId,
      actionType: 'AUTOMATION_RUN_COMPLETED',
      entityType: 'automation_runs',
      entityId: inserted[0].id,
      actionDetails: {
        jobsDiscovered: activeJobs.length,
        jobsMatched: matched.length,
      },
    });

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in executeUserAutomationRun:', error);
    throw new Error('Failed to run automation cycle.', { cause: error });
  }
}

// ---------------------------------------------------------------------------
// ADMIN DATABASE OVERVIEW (Restricted to role === 'admin')
// ---------------------------------------------------------------------------

export async function getAdminDatabaseOverview(): Promise<AdminOverviewStats> {
  try {
    const [
      userCountRows,
      docCountRows,
      resumeCountRows,
      jdCountRows,
      jobCountRows,
      appCountRows,
      emailCountRows,
      tplCountRows,
      dbSizeRows,
      latestRuns,
      recentLogs,
      privateStorageBytes,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(candidateDocuments),
      db.select({ count: sql<number>`count(*)::int` }).from(generatedResumes),
      db.select({ count: sql<number>`count(*)::int` }).from(jobDescriptions),
      db.select({ count: sql<number>`count(*)::int` }).from(jobs),
      db.select({ count: sql<number>`count(*)::int` }).from(applications),
      db.select({ count: sql<number>`count(*)::int` }).from(emailMessages),
      db.select({ count: sql<number>`count(*)::int` }).from(resumeTemplates),
      db.execute(sql`SELECT pg_database_size(current_database())::bigint AS size_bytes`),
      db.select().from(automationRuns).orderBy(desc(automationRuns.createdAt)).limit(10),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(15),
      getPrivateStorageTotalBytes(),
    ]);

    const sizeRow = dbSizeRows.rows[0] as { size_bytes?: string | number } | undefined;

    return {
      totalUsers: Number(userCountRows[0]?.count ?? 0),
      totalUploadedDocuments: Number(docCountRows[0]?.count ?? 0),
      totalGeneratedResumes: Number(resumeCountRows[0]?.count ?? 0),
      totalJobDescriptions: Number(jdCountRows[0]?.count ?? 0),
      totalDiscoveredJobs: Number(jobCountRows[0]?.count ?? 0),
      totalApplications: Number(appCountRows[0]?.count ?? 0),
      totalEmailsSent: Number(emailCountRows[0]?.count ?? 0),
      totalTemplates: Number(tplCountRows[0]?.count ?? 0),
      databaseSizeBytes: Number(sizeRow?.size_bytes ?? 0),
      privateStorageBytes,
      latestAutomationRuns: latestRuns.map((r) => ({
        ...r,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
      recentAuditLogs: recentLogs.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('Database query failed in getAdminDatabaseOverview:', error);
    throw new Error('Failed to load administrative overview.', { cause: error });
  }
}
