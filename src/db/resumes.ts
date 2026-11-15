import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  atsAnalysis as atsAnalysisTable,
  auditLogs,
  generatedResumes,
  jobDescriptions,
  masterResumes,
  resumeTemplates,
} from './schema.ts';
import { RESUME_TEMPLATES, normalizeTemplateId } from '../lib/templates.ts';
import type {
  AtsAnalysisResult,
  FactualVerificationResult,
  GenerationMode,
  JobDescriptionAnalysis,
  MasterResumeData,
  ResumeTemplateId,
  ReviewerReport,
  TailoredResumeContent,
  TemplateCustomization,
} from '../types/resume.ts';

function flattenTailoredResumeText(content: TailoredResumeContent): string {
  const parts: string[] = [
    content.personalInfo.fullName,
    content.professionalTitle,
    content.professionalSummary,
    ...content.coreCompetencies,
    ...content.technicalSkills,
    ...content.erpAndSoftwareKnowledge,
    ...content.professionalExperience.flatMap((e) => [
      e.jobTitle,
      e.companyName,
      ...e.bullets,
    ]),
  ];
  return parts.filter(Boolean).join('\n');
}

export async function syncResumeTemplatesCatalog() {
  try {
    for (const tpl of RESUME_TEMPLATES) {
      await db
        .insert(resumeTemplates)
        .values({
          slug: tpl.id,
          templateName: tpl.name,
          templateCategory: tpl.category,
          templateDescription: tpl.description,
          templatePreviewPath: `/templates/previews/${tpl.id}.png`,
          atsClassification: tpl.atsClassification,
          layoutType: tpl.defaultCustomization.layout,
          designConfiguration: tpl.defaultCustomization,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: resumeTemplates.slug,
          set: {
            templateName: tpl.name,
            templateCategory: tpl.category,
            templateDescription: tpl.description,
            atsClassification: tpl.atsClassification,
            layoutType: tpl.defaultCustomization.layout,
            designConfiguration: tpl.defaultCustomization,
          },
        });
    }
    return await db.select().from(resumeTemplates).orderBy(resumeTemplates.templateCategory);
  } catch (error) {
    console.error('Database query failed in syncResumeTemplatesCatalog:', error);
    throw new Error('Failed to synchronize resume templates catalog.', { cause: error });
  }
}

export async function listResumeTemplatesFromDb() {
  try {
    const existing = await db.select().from(resumeTemplates);
    if (existing.length < RESUME_TEMPLATES.length) {
      return await syncResumeTemplatesCatalog();
    }
    return existing;
  } catch (error) {
    console.error('Database query failed in listResumeTemplatesFromDb:', error);
    throw new Error('Failed to load resume templates.', { cause: error });
  }
}

export async function getTemplateUuidBySlug(slug: ResumeTemplateId): Promise<string | null> {
  try {
    const normalized = normalizeTemplateId(slug);
    let rows = await db
      .select({ id: resumeTemplates.id })
      .from(resumeTemplates)
      .where(eq(resumeTemplates.slug, normalized))
      .limit(1);

    if (!rows[0]) {
      await syncResumeTemplatesCatalog();
      rows = await db
        .select({ id: resumeTemplates.id })
        .from(resumeTemplates)
        .where(eq(resumeTemplates.slug, normalized))
        .limit(1);
    }
    return rows[0]?.id ?? null;
  } catch (error) {
    console.error('Database query failed in getTemplateUuidBySlug:', error);
    return null;
  }
}

export async function createJobDescriptionRecord(params: {
  userId: number;
  companyName: string;
  jobTitle: string;
  jobLocation?: string;
  jobDescription: string;
  jobUrl?: string;
  employmentType?: string;
  experienceRequired?: string;
  salaryRange?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  requiredKeywords?: string[];
  jobSource?: string;
}) {
  try {
    const inserted = await db
      .insert(jobDescriptions)
      .values({
        userId: params.userId,
        companyName: params.companyName || 'Target Company',
        jobTitle: params.jobTitle || 'Target Role',
        jobLocation: params.jobLocation ?? '',
        jobDescription: params.jobDescription,
        jobUrl: params.jobUrl ?? '',
        employmentType: params.employmentType ?? '',
        experienceRequired: params.experienceRequired ?? '',
        salaryRange: params.salaryRange ?? '',
        requiredSkills: params.requiredSkills ?? [],
        preferredSkills: params.preferredSkills ?? [],
        requiredKeywords: params.requiredKeywords ?? [],
        jobSource: params.jobSource ?? 'manual_paste',
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createJobDescriptionRecord:', error);
    throw new Error('Failed to save job description.', { cause: error });
  }
}

export async function listJobDescriptionsByUserId(userId: number) {
  try {
    return await db
      .select()
      .from(jobDescriptions)
      .where(eq(jobDescriptions.userId, userId))
      .orderBy(desc(jobDescriptions.createdAt));
  } catch (error) {
    console.error('Database query failed in listJobDescriptionsByUserId:', error);
    throw new Error('Failed to load saved job descriptions.', { cause: error });
  }
}

export async function getMasterResumeByUserId(userId: number) {
  try {
    const rows = await db
      .select()
      .from(masterResumes)
      .where(eq(masterResumes.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getMasterResumeByUserId:', error);
    throw new Error('Failed to load Master Resume.', { cause: error });
  }
}

export async function upsertMasterResume(params: {
  userId: number;
  originalFileName?: string | null;
  originalMimeType?: string | null;
  fileSizeBytes?: number | null;
  structuredData: MasterResumeData;
  isApproved: boolean;
}) {
  try {
    const existing = await getMasterResumeByUserId(params.userId);
    if (existing) {
      const updated = await db
        .update(masterResumes)
        .set({
          originalFileName:
            params.originalFileName !== undefined
              ? params.originalFileName
              : existing.originalFileName,
          originalMimeType:
            params.originalMimeType !== undefined
              ? params.originalMimeType
              : existing.originalMimeType,
          fileSizeBytes:
            params.fileSizeBytes !== undefined
              ? params.fileSizeBytes
              : existing.fileSizeBytes,
          structuredData: params.structuredData,
          isApproved: params.isApproved,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(masterResumes.id, existing.id), eq(masterResumes.userId, params.userId)))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(masterResumes)
      .values({
        userId: params.userId,
        originalFileName: params.originalFileName ?? null,
        originalMimeType: params.originalMimeType ?? null,
        fileSizeBytes: params.fileSizeBytes ?? null,
        structuredData: params.structuredData,
        isApproved: params.isApproved,
        version: 1,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in upsertMasterResume:', error);
    throw new Error('Failed to save Master Resume.', { cause: error });
  }
}

export async function deleteMasterResumeByUserId(userId: number) {
  try {
    await db.delete(masterResumes).where(eq(masterResumes.userId, userId));
  } catch (error) {
    console.error('Database query failed in deleteMasterResumeByUserId:', error);
    throw new Error('Failed to delete Master Resume.', { cause: error });
  }
}

export async function getNextResumeVersionForUser(userId: number): Promise<number> {
  try {
    const rows = await db
      .select({ maxVersion: sql<number>`coalesce(max(${generatedResumes.version}), 0)` })
      .from(generatedResumes)
      .where(eq(generatedResumes.userId, userId));
    return Number(rows[0]?.maxVersion ?? 0) + 1;
  } catch (error) {
    console.error('Database query failed in getNextResumeVersionForUser:', error);
    throw new Error('Failed to determine resume version.', { cause: error });
  }
}

export async function createGeneratedResume(params: {
  userId: number;
  masterResumeId: number | null;
  jobDescriptionId?: string | null;
  originalDocumentId?: string | null;
  jobTitle: string;
  companyName: string;
  originalJd: string;
  jdAnalysis: JobDescriptionAnalysis;
  generationMode: GenerationMode;
  templateId: ResumeTemplateId;
  templateCustomization?: TemplateCustomization | null;
  tailoredResume: TailoredResumeContent;
  pdfStoragePath?: string;
  docxStoragePath?: string;
  atsAnalysis: AtsAnalysisResult;
  factualVerification: FactualVerificationResult;
  reviewReport: ReviewerReport;
  aiModel: string;
}) {
  try {
    const version = await getNextResumeVersionForUser(params.userId);
    const templateUuid = await getTemplateUuidBySlug(params.templateId);
    const resumeTitle = `${params.jobTitle} — ${params.companyName} (v${version})`;
    const generatedText = flattenTailoredResumeText(params.tailoredResume);
    const origScore =
      typeof params.atsAnalysis.originalAtsScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(params.atsAnalysis.originalAtsScore)))
        : null;
    const finalScore = Math.max(
      0,
      Math.min(100, Math.round(params.atsAnalysis.estimatedAlignmentScore)),
    );
    const kwScore =
      typeof params.atsAnalysis.keywordMatchPercentage === 'number'
        ? Math.max(0, Math.min(100, Math.round(params.atsAnalysis.keywordMatchPercentage)))
        : null;
    const skillsScore =
      typeof params.atsAnalysis.skillsMatchPercentage === 'number'
        ? Math.max(0, Math.min(100, Math.round(params.atsAnalysis.skillsMatchPercentage)))
        : null;
    const expScore =
      typeof params.atsAnalysis.experienceRelevancePercentage === 'number'
        ? Math.max(0, Math.min(100, Math.round(params.atsAnalysis.experienceRelevancePercentage)))
        : null;
    const fmtScore =
      (params.atsAnalysis.formattingIssues?.length ?? 0) === 0 ? 100 : 80;

    const inserted = await db
      .insert(generatedResumes)
      .values({
        userId: params.userId,
        masterResumeId: params.masterResumeId,
        jobDescriptionId: params.jobDescriptionId ?? null,
        originalDocumentId: params.originalDocumentId ?? null,
        resumeTemplateUuid: templateUuid,
        resumeTitle,
        jobTitle: params.jobTitle,
        companyName: params.companyName,
        originalJd: params.originalJd,
        jdAnalysis: params.jdAnalysis,
        generationMode: params.generationMode,
        templateId: params.templateId,
        templateCustomization: params.templateCustomization ?? null,
        tailoredResume: params.tailoredResume,
        generatedText,
        pdfStoragePath: params.pdfStoragePath ?? '',
        docxStoragePath: params.docxStoragePath ?? '',
        originalAtsScore: origScore,
        finalAtsScore: finalScore,
        keywordMatchScore: kwScore,
        skillsMatchScore: skillsScore,
        experienceMatchScore: expScore,
        formattingScore: fmtScore,
        missingKeywords: params.atsAnalysis.missingKeywords ?? [],
        improvementNotes: params.atsAnalysis.improvementRecommendations ?? [],
        generationStatus: 'completed',
        atsAnalysis: params.atsAnalysis,
        factualVerification: params.factualVerification,
        reviewReport: params.reviewReport,
        aiModel: params.aiModel,
        version,
      })
      .returning();

    const record = inserted[0];

    await db.insert(atsAnalysisTable).values({
      userId: params.userId,
      jobDescriptionId: params.jobDescriptionId ?? null,
      generatedResumeId: record.id,
      originalScore: origScore ?? 0,
      finalScore,
      requiredKeywordMatches: params.atsAnalysis.matchedKeywords ?? [],
      missingRequiredKeywords:
        params.atsAnalysis.missingMandatorySkills ?? params.atsAnalysis.missingKeywords ?? [],
      preferredKeywordMatches: params.atsAnalysis.partiallyMatchedKeywords ?? [],
      skillsMatch: {
        skillsMatchPercentage: skillsScore ?? finalScore,
        transferableSkills: params.atsAnalysis.transferableSkills ?? [],
      },
      experienceAlignment: params.atsAnalysis.relevantExperienceHighlights ?? [],
      formattingIssues: params.atsAnalysis.formattingIssues ?? [],
      improvementRecommendations: params.atsAnalysis.improvementRecommendations ?? [],
      analysisDetails: params.atsAnalysis,
    });

    await db.insert(auditLogs).values({
      userId: params.userId,
      actionType: 'RESUME_GENERATED',
      entityType: 'generated_resumes',
      entityId: String(record.id),
      actionDetails: {
        jobTitle: params.jobTitle,
        companyName: params.companyName,
        templateId: params.templateId,
        finalScore,
      },
    });

    return record;
  } catch (error) {
    console.error('Database query failed in createGeneratedResume:', error);
    throw new Error('Failed to save tailored resume version.', { cause: error });
  }
}

export async function listGeneratedResumesByUserId(userId: number) {
  try {
    return await db
      .select()
      .from(generatedResumes)
      .where(eq(generatedResumes.userId, userId))
      .orderBy(desc(generatedResumes.createdAt));
  } catch (error) {
    console.error('Database query failed in listGeneratedResumesByUserId:', error);
    throw new Error('Failed to load resume history.', { cause: error });
  }
}

export async function getGeneratedResumeById(id: number, userId: number) {
  try {
    const rows = await db
      .select()
      .from(generatedResumes)
      .where(and(eq(generatedResumes.id, id), eq(generatedResumes.userId, userId)))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getGeneratedResumeById:', error);
    throw new Error('Failed to load tailored resume.', { cause: error });
  }
}

export async function updateGeneratedResumeById(params: {
  id: number;
  userId: number;
  jobTitle?: string;
  companyName?: string;
  templateId?: ResumeTemplateId;
  templateCustomization?: TemplateCustomization | null;
  tailoredResume?: TailoredResumeContent;
  pdfStoragePath?: string;
  docxStoragePath?: string;
  factualVerification?: FactualVerificationResult;
  atsAnalysis?: AtsAnalysisResult;
}) {
  try {
    const setValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (params.jobTitle !== undefined) setValues.jobTitle = params.jobTitle;
    if (params.companyName !== undefined) setValues.companyName = params.companyName;
    if (params.templateId !== undefined) {
      setValues.templateId = params.templateId;
      const tplUuid = await getTemplateUuidBySlug(params.templateId);
      if (tplUuid) setValues.resumeTemplateUuid = tplUuid;
    }
    if (params.templateCustomization !== undefined) {
      setValues.templateCustomization = params.templateCustomization;
    }
    if (params.tailoredResume !== undefined) {
      setValues.tailoredResume = params.tailoredResume;
      setValues.generatedText = flattenTailoredResumeText(params.tailoredResume);
    }
    if (params.pdfStoragePath !== undefined) setValues.pdfStoragePath = params.pdfStoragePath;
    if (params.docxStoragePath !== undefined) setValues.docxStoragePath = params.docxStoragePath;
    if (params.factualVerification !== undefined) {
      setValues.factualVerification = params.factualVerification;
    }
    if (params.atsAnalysis !== undefined) {
      setValues.atsAnalysis = params.atsAnalysis;
      setValues.finalAtsScore = Math.max(
        0,
        Math.min(100, Math.round(params.atsAnalysis.estimatedAlignmentScore)),
      );
      setValues.missingKeywords = params.atsAnalysis.missingKeywords ?? [];
      setValues.improvementNotes = params.atsAnalysis.improvementRecommendations ?? [];
    }

    const updated = await db
      .update(generatedResumes)
      .set(setValues)
      .where(and(eq(generatedResumes.id, params.id), eq(generatedResumes.userId, params.userId)))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateGeneratedResumeById:', error);
    throw new Error('Failed to update tailored resume.', { cause: error });
  }
}

export async function duplicateGeneratedResumeWithTemplate(params: {
  sourceId: number;
  userId: number;
  templateId: ResumeTemplateId;
  templateCustomization?: TemplateCustomization | null;
  tailoredResumeOverride?: TailoredResumeContent;
  pdfStoragePath?: string;
  docxStoragePath?: string;
}) {
  try {
    const source = await getGeneratedResumeById(params.sourceId, params.userId);
    if (!source) return null;

    return await createGeneratedResume({
      userId: params.userId,
      masterResumeId: source.masterResumeId,
      jobDescriptionId: source.jobDescriptionId,
      originalDocumentId: source.originalDocumentId,
      jobTitle: source.jobTitle,
      companyName: source.companyName,
      originalJd: source.originalJd,
      jdAnalysis: source.jdAnalysis,
      generationMode: source.generationMode,
      templateId: params.templateId,
      templateCustomization: params.templateCustomization ?? null,
      tailoredResume: params.tailoredResumeOverride ?? source.tailoredResume,
      pdfStoragePath: params.pdfStoragePath,
      docxStoragePath: params.docxStoragePath,
      atsAnalysis: source.atsAnalysis,
      factualVerification: source.factualVerification,
      reviewReport: source.reviewReport,
      aiModel: source.aiModel,
    });
  } catch (error) {
    console.error('Database query failed in duplicateGeneratedResumeWithTemplate:', error);
    throw new Error('Failed to save new resume version with selected template.', { cause: error });
  }
}

export async function deleteGeneratedResumeById(id: number, userId: number) {
  try {
    const deleted = await db
      .delete(generatedResumes)
      .where(and(eq(generatedResumes.id, id), eq(generatedResumes.userId, userId)))
      .returning({ id: generatedResumes.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteGeneratedResumeById:', error);
    throw new Error('Failed to delete tailored resume.', { cause: error });
  }
}

export async function deleteAllGeneratedResumesByUserId(userId: number) {
  try {
    await db.delete(generatedResumes).where(eq(generatedResumes.userId, userId));
  } catch (error) {
    console.error('Database query failed in deleteAllGeneratedResumesByUserId:', error);
    throw new Error('Failed to delete resume history.', { cause: error });
  }
}
