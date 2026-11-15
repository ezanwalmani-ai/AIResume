import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requireAdmin, type AuthRequest } from './src/middleware/auth.ts';
import { deleteUserAccountData, updateUserPreferences } from './src/db/users.ts';
import {
  createGeneratedResume,
  createJobDescriptionRecord,
  deleteAllGeneratedResumesByUserId,
  deleteGeneratedResumeById,
  deleteMasterResumeByUserId,
  duplicateGeneratedResumeWithTemplate,
  getGeneratedResumeById,
  getMasterResumeByUserId,
  listGeneratedResumesByUserId,
  listJobDescriptionsByUserId,
  listResumeTemplatesFromDb,
  syncResumeTemplatesCatalog,
  updateGeneratedResumeById,
  upsertMasterResume,
} from './src/db/resumes.ts';
import {
  createApplicationRecord,
  createCandidateDocument,
  createRecruiterRecord,
  deleteApplicationById,
  deleteCandidateDocumentById,
  deleteRecruiterById,
  executeUserAutomationRun,
  getAdminDatabaseOverview,
  getCandidateDocumentById,
  getCandidateProfileByUserId,
  getOrCreateJobPreferences,
  listApplicationsByUserId,
  listAuditLogsByUserId,
  listAutomationRunsByUserId,
  listCandidateDocumentsByUserId,
  listEmailMessagesByUserId,
  listJobListings,
  listRecruitersByUserId,
  recordAuditLog,
  recordConfirmedEmailMessage,
  syncCandidateProfileFromMasterData,
  updateApplicationById,
  updateRecruiterById,
  upsertCandidateProfile,
  upsertJobListing,
  upsertJobPreferences,
} from './src/db/workspace.ts';
import {
  createSignedStorageToken,
  deletePrivateFile,
  readPrivateFile,
  savePrivateFile,
  verifySignedStorageToken,
} from './src/server/storage.ts';
import {
  analyzeAtsAlignment,
  analyzeJobDescription,
  extractMasterResumeFromFile,
  extractMasterResumeFromText,
  extractTextFromJdFile,
  generateAtsKeywordExplanations,
  generateTailoredResume,
  getConfiguredModel,
  matchResumeToJobDescription,
  optimizeResumeSection,
  reviewAndPolishResume,
  runFactualVerificationPipeline,
  scoreOriginalMasterResume,
  type BaselineAtsScore,
} from './src/server/gemini.ts';
import { enforceAndVerifyFactualAccuracy } from './src/server/factualGuard.ts';
import {
  buildResumeDownloadFilename,
  generateResumeDocx,
  generateResumePdf,
  validateResumeExport,
} from './src/server/export.ts';
import type {
  GenerationMode,
  JobDescriptionAnalysis,
  MasterResumeData,
  OptimizationAction,
  ResumeTemplateId,
  TailoredResumeContent,
  TemplateCustomization,
} from './src/types/resume.ts';
import { APPLICATION_STATUSES, type ApplicationStatus } from './src/types/database.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '5mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max resume file
  fileFilter: (_req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    const allowedMimes = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]);
    if (
      allowedMimes.has(file.mimetype) ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.docx') ||
      lower.endsWith('.txt')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload a PDF, DOCX, or TXT resume.'));
    }
  },
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: getConfiguredModel() });
});

// ---------------------------------------------------------------------------
// USER SETTINGS & PRIVACY CONTROLS
// ---------------------------------------------------------------------------

app.get('/api/me', requireAuth, (req: AuthRequest, res) => {
  const user = req.dbUser!;
  res.json({
    id: user.id,
    uuid: user.uuid,
    email: user.email,
    fullName: user.fullName,
    displayName: user.displayName,
    phone: user.phone,
    role: user.role,
    isAdmin: user.role === 'admin',
    defaultMode: user.defaultMode,
    defaultTemplate: user.defaultTemplate,
  });
});

app.put('/api/me/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.dbUser!;
    const { defaultMode, defaultTemplate, displayName, fullName, phone } = req.body as {
      defaultMode?: GenerationMode;
      defaultTemplate?: ResumeTemplateId;
      displayName?: string | null;
      fullName?: string | null;
      phone?: string | null;
    };

    const updated = await updateUserPreferences(user.id, {
      ...(defaultMode ? { defaultMode } : {}),
      ...(defaultTemplate ? { defaultTemplate } : {}),
      ...(displayName !== undefined ? { displayName } : {}),
      ...(fullName !== undefined ? { fullName } : {}),
      ...(phone !== undefined ? { phone } : {}),
    });

    await recordAuditLog({
      userId: user.id,
      actionType: 'USER_SETTINGS_UPDATED',
      entityType: 'users',
      entityId: String(user.id),
      actionDetails: { defaultMode: updated.defaultMode, defaultTemplate: updated.defaultTemplate },
    });

    res.json({
      id: updated.id,
      uuid: updated.uuid,
      email: updated.email,
      fullName: updated.fullName,
      displayName: updated.displayName,
      phone: updated.phone,
      role: updated.role,
      isAdmin: updated.role === 'admin',
      defaultMode: updated.defaultMode,
      defaultTemplate: updated.defaultTemplate,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update settings.' });
  }
});

app.delete('/api/me/account-data', requireAuth, async (req: AuthRequest, res) => {
  try {
    const docs = await listCandidateDocumentsByUserId(req.dbUser!.id);
    const resList = await listGeneratedResumesByUserId(req.dbUser!.id);
    await deleteUserAccountData(req.dbUser!.id);
    for (const d of docs) {
      await deletePrivateFile(d.storagePath);
    }
    for (const r of resList) {
      if (r.pdfStoragePath) await deletePrivateFile(r.pdfStoragePath);
      if (r.docxStoragePath) await deletePrivateFile(r.docxStoragePath);
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete account data.' });
  }
});

// ---------------------------------------------------------------------------
// MASTER RESUME ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/master-resume', requireAuth, async (req: AuthRequest, res) => {
  try {
    const record = await getMasterResumeByUserId(req.dbUser!.id);
    res.json({ masterResume: record });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load Master Resume.' });
  }
});

app.post(
  '/api/master-resume/extract',
  requireAuth,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'File upload failed.' });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res) => {
    try {
      if (req.file) {
        const { data, modelUsed } = await extractMasterResumeFromFile(
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname,
        );
        const stored = await savePrivateFile(
          `users/${req.dbUser!.id}/uploads`,
          req.file.originalname,
          req.file.buffer,
        );
        const docFormat = req.file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
        const docRecord = await createCandidateDocument({
          userId: req.dbUser!.id,
          documentName: req.file.originalname,
          documentType: 'master_resume',
          storagePath: stored.storagePath,
          fileFormat: docFormat,
          fileSize: stored.sizeBytes,
          isMasterResume: true,
          extractedText: data.professionalSummary || '',
        });
        const saved = await upsertMasterResume({
          userId: req.dbUser!.id,
          originalFileName: req.file.originalname,
          originalMimeType: req.file.mimetype,
          fileSizeBytes: req.file.size,
          structuredData: data,
          isApproved: false,
        });
        await syncCandidateProfileFromMasterData(req.dbUser!.id, data);
        res.json({ masterResume: saved, document: docRecord, modelUsed });
        return;
      }

      const { rawText } = req.body as { rawText?: string };
      if (!rawText || !rawText.trim()) {
        res.status(400).json({ error: 'Please upload a PDF/DOCX file or paste resume text.' });
        return;
      }

      const { data, modelUsed } = await extractMasterResumeFromText(rawText);
      const rawBuffer = Buffer.from(rawText, 'utf8');
      const stored = await savePrivateFile(
        `users/${req.dbUser!.id}/uploads`,
        'pasted_resume.txt',
        rawBuffer,
      );
      const docRecord = await createCandidateDocument({
        userId: req.dbUser!.id,
        documentName: 'pasted_resume.txt',
        documentType: 'master_resume',
        storagePath: stored.storagePath,
        fileFormat: 'txt',
        fileSize: stored.sizeBytes,
        isMasterResume: true,
        extractedText: rawText,
      });
      const saved = await upsertMasterResume({
        userId: req.dbUser!.id,
        originalFileName: 'pasted_resume.txt',
        originalMimeType: 'text/plain',
        fileSizeBytes: rawBuffer.byteLength,
        structuredData: data,
        isApproved: false,
      });
      await syncCandidateProfileFromMasterData(req.dbUser!.id, data);
      res.json({ masterResume: saved, document: docRecord, modelUsed });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to extract resume information.',
      });
    }
  },
);

app.put('/api/master-resume', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { structuredData, isApproved } = req.body as {
      structuredData?: MasterResumeData;
      isApproved?: boolean;
    };

    if (!structuredData || !structuredData.personalInfo?.fullName?.trim()) {
      res.status(400).json({ error: 'Full name and structured resume data are required.' });
      return;
    }

    const saved = await upsertMasterResume({
      userId: req.dbUser!.id,
      structuredData,
      isApproved: isApproved ?? true,
    });
    await syncCandidateProfileFromMasterData(req.dbUser!.id, structuredData);
    await recordAuditLog({
      userId: req.dbUser!.id,
      actionType: 'MASTER_RESUME_UPDATED',
      entityType: 'master_resumes',
      entityId: String(saved.id),
      actionDetails: { version: saved.version, isApproved: saved.isApproved },
    });

    res.json({ masterResume: saved });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save Master Resume.' });
  }
});

app.delete('/api/master-resume', requireAuth, async (req: AuthRequest, res) => {
  try {
    await deleteMasterResumeByUserId(req.dbUser!.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete Master Resume.' });
  }
});

// ---------------------------------------------------------------------------
// JOB DESCRIPTION EXTRACTION & PRE-GENERATION ANALYSIS
// ---------------------------------------------------------------------------

app.post(
  '/api/jd/extract',
  requireAuth,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Job description file upload failed.' });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Please upload a PDF, DOCX, or TXT job description file.' });
        return;
      }

      const jdText = await extractTextFromJdFile(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );

      if (jdText.trim().length < 30) {
        res.status(400).json({ error: 'The uploaded job description contains too little text to analyze.' });
        return;
      }

      const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
      const jdAnalysis = await analyzeJobDescription(jdText, masterRecord?.structuredData);

      const savedJd = await createJobDescriptionRecord({
        userId: req.dbUser!.id,
        companyName: jdAnalysis.companyName || 'Target Company',
        jobTitle: jdAnalysis.jobTitle || 'Target Role',
        jobDescription: jdText,
        experienceRequired: jdAnalysis.requiredExperience || '',
        requiredSkills: jdAnalysis.technicalSkills || [],
        preferredSkills: jdAnalysis.preferredSkills || [],
        requiredKeywords: jdAnalysis.importantAtsKeywords || [],
        jobSource: 'file_upload',
      });

      res.json({ jdText, jdAnalysis, jobDescriptionId: savedJd.id });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to extract job description.',
      });
    }
  },
);

app.post('/api/jd/analyze', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { jobDescription } = req.body as { jobDescription?: string };
    if (!jobDescription || jobDescription.trim().length < 30) {
      res.status(400).json({ error: 'Please provide at least 30 characters of job description text.' });
      return;
    }

    const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
    const jdAnalysis = await analyzeJobDescription(
      jobDescription.trim(),
      masterRecord?.structuredData,
    );

    const savedJd = await createJobDescriptionRecord({
      userId: req.dbUser!.id,
      companyName: jdAnalysis.companyName || 'Target Company',
      jobTitle: jdAnalysis.jobTitle || 'Target Role',
      jobDescription: jobDescription.trim(),
      experienceRequired: jdAnalysis.requiredExperience || '',
      requiredSkills: jdAnalysis.technicalSkills || [],
      preferredSkills: jdAnalysis.preferredSkills || [],
      requiredKeywords: jdAnalysis.importantAtsKeywords || [],
      jobSource: 'manual_paste',
    });

    res.json({ jdAnalysis, jobDescriptionId: savedJd.id });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to analyze job description.',
    });
  }
});

// ---------------------------------------------------------------------------
// TAILORED RESUME GENERATION PIPELINE (8-STEP SSE STREAMING WITH AUTO-OPTIMIZER)
// ---------------------------------------------------------------------------

app.post('/api/resumes/generate', requireAuth, async (req: AuthRequest, res) => {
  const {
    jobDescription,
    jobDescriptionId,
    mode,
    templateId,
    templateCustomization,
    companyOverride,
    jobTitleOverride,
    precomputedJdAnalysis,
  } = req.body as {
    jobDescription?: string;
    jobDescriptionId?: string;
    mode?: GenerationMode;
    templateId?: ResumeTemplateId;
    templateCustomization?: TemplateCustomization | null;
    companyOverride?: string;
    jobTitleOverride?: string;
    precomputedJdAnalysis?: JobDescriptionAnalysis;
  };

  if (!jobDescription || jobDescription.trim().length < 30) {
    res.status(400).json({ error: 'Please paste a complete job description (at least 30 characters).' });
    return;
  }

  const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
  if (!masterRecord) {
    res.status(400).json({ error: 'Please upload and save your Master Resume before generating.' });
    return;
  }

  // Configure Server-Sent Events stream for real-time stage updates
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const selectedMode: GenerationMode = mode || req.dbUser!.defaultMode || 'balanced';
    const selectedTemplate: ResumeTemplateId =
      templateId || req.dbUser!.defaultTemplate || 'classic_ats';
    const modelUsed = getConfiguredModel();
    const totalSteps = 8;

    sendEvent('progress', {
      step: 1,
      total: totalSteps,
      label: 'Analyzing job description, requirements, and profile gaps',
    });
    const jdAnalysis = precomputedJdAnalysis
      ? { ...precomputedJdAnalysis }
      : await analyzeJobDescription(jobDescription.trim(), masterRecord.structuredData);
    if (companyOverride?.trim()) jdAnalysis.companyName = companyOverride.trim();
    if (jobTitleOverride?.trim()) jdAnalysis.jobTitle = jobTitleOverride.trim();

    sendEvent('progress', {
      step: 2,
      total: totalSteps,
      label: 'Scoring un-tailored Master Resume ATS baseline',
    });
    const baseline = await scoreOriginalMasterResume(masterRecord.structuredData, jdAnalysis);

    sendEvent('progress', {
      step: 3,
      total: totalSteps,
      label: 'Mapping verified experience and transferable skills',
    });
    const matchResult = await matchResumeToJobDescription(masterRecord.structuredData, jdAnalysis);

    sendEvent('progress', {
      step: 4,
      total: totalSteps,
      label: 'Generating tailored resume content',
    });
    const draftTailored = await generateTailoredResume(
      masterRecord.structuredData,
      jdAnalysis,
      matchResult,
      selectedMode,
    );

    sendEvent('progress', {
      step: 5,
      total: totalSteps,
      label: 'Running factual consistency check and independent AI review',
    });
    const verificationStep = await runFactualVerificationPipeline(
      masterRecord.structuredData,
      draftTailored,
    );

    const reviewed = await reviewAndPolishResume(
      masterRecord.structuredData,
      jdAnalysis,
      verificationStep.lockedResume,
      verificationStep.verification,
    );

    let finalVerification = await runFactualVerificationPipeline(
      masterRecord.structuredData,
      reviewed.finalResume,
    );

    sendEvent('progress', {
      step: 6,
      total: totalSteps,
      label: 'Calculating 6-category weighted ATS compatibility score',
    });
    let atsAnalysis = await analyzeAtsAlignment(
      masterRecord.structuredData,
      jdAnalysis,
      finalVerification.lockedResume,
      baseline,
    );

    if (atsAnalysis.estimatedAlignmentScore < 75) {
      sendEvent('progress', {
        step: 7,
        total: totalSteps,
        label: `ATS score is ${atsAnalysis.estimatedAlignmentScore}% (<75%) — running proactive optimization pass`,
      });

      const improved = await optimizeResumeSection(
        masterRecord.structuredData,
        jdAnalysis,
        finalVerification.lockedResume,
        atsAnalysis,
        'improve_ats',
      );

      const improvedVerification = await runFactualVerificationPipeline(
        masterRecord.structuredData,
        improved.improvedResume,
      );

      const improvedAts = await analyzeAtsAlignment(
        masterRecord.structuredData,
        jdAnalysis,
        improvedVerification.lockedResume,
        baseline,
      );

      if (improvedAts.estimatedAlignmentScore >= atsAnalysis.estimatedAlignmentScore) {
        finalVerification = improvedVerification;
        atsAnalysis = {
          ...improvedAts,
          autoImprovementApplied: true,
          autoImprovementNotes: improved.improvementsApplied,
        };
      } else {
        atsAnalysis = {
          ...atsAnalysis,
          autoImprovementApplied: true,
          autoImprovementNotes: [
            'Evaluated proactive optimization pass; retained earlier pass because it preserved higher verified ATS alignment.',
            ...improved.improvementsApplied,
          ],
        };
      }
    } else {
      sendEvent('progress', {
        step: 7,
        total: totalSteps,
        label: `Target ATS compatibility achieved (${atsAnalysis.estimatedAlignmentScore}% >= 75%)`,
      });
    }

    sendEvent('progress', {
      step: 8,
      total: totalSteps,
      label: 'Generating private PDF/DOCX artifacts and saving to SQL database',
    });

    let resolvedJdId = jobDescriptionId ?? null;
    if (!resolvedJdId) {
      const savedJd = await createJobDescriptionRecord({
        userId: req.dbUser!.id,
        companyName: jdAnalysis.companyName || 'Target Company',
        jobTitle: jdAnalysis.jobTitle || 'Tailored Position',
        jobDescription: jobDescription.trim(),
        experienceRequired: jdAnalysis.requiredExperience || '',
        requiredSkills: jdAnalysis.technicalSkills || [],
        preferredSkills: jdAnalysis.preferredSkills || [],
        requiredKeywords: jdAnalysis.importantAtsKeywords || [],
        jobSource: 'generate_pipeline',
      });
      resolvedJdId = savedJd.id;
    }

    const docs = await listCandidateDocumentsByUserId(req.dbUser!.id);
    const masterDoc = docs.find((d) => d.isMasterResume) ?? docs[0] ?? null;

    let pdfStoragePath = '';
    let docxStoragePath = '';
    try {
      const [pdfBuf, docxBuf] = await Promise.all([
        generateResumePdf(
          finalVerification.lockedResume,
          selectedTemplate,
          templateCustomization ?? null,
        ),
        generateResumeDocx(
          finalVerification.lockedResume,
          selectedTemplate,
          templateCustomization ?? null,
        ),
      ]);
      const pdfFileName = buildResumeDownloadFilename(
        finalVerification.lockedResume,
        jdAnalysis.jobTitle || 'Role',
        jdAnalysis.companyName || 'Company',
        'pdf',
      );
      const docxFileName = buildResumeDownloadFilename(
        finalVerification.lockedResume,
        jdAnalysis.jobTitle || 'Role',
        jdAnalysis.companyName || 'Company',
        'docx',
      );
      const [savedPdf, savedDocx] = await Promise.all([
        savePrivateFile(`users/${req.dbUser!.id}/generated`, pdfFileName, pdfBuf),
        savePrivateFile(`users/${req.dbUser!.id}/generated`, docxFileName, docxBuf),
      ]);
      pdfStoragePath = savedPdf.storagePath;
      docxStoragePath = savedDocx.storagePath;
    } catch (storageErr) {
      console.error('Non-fatal error saving generated resume artifacts:', storageErr);
    }

    const saved = await createGeneratedResume({
      userId: req.dbUser!.id,
      masterResumeId: masterRecord.id,
      jobDescriptionId: resolvedJdId,
      originalDocumentId: masterDoc?.id ?? null,
      jobTitle: jdAnalysis.jobTitle || 'Tailored Position',
      companyName: jdAnalysis.companyName || 'Target Company',
      originalJd: jobDescription.trim(),
      jdAnalysis,
      generationMode: selectedMode,
      templateId: selectedTemplate,
      templateCustomization: templateCustomization ?? null,
      tailoredResume: finalVerification.lockedResume,
      pdfStoragePath,
      docxStoragePath,
      atsAnalysis,
      factualVerification: finalVerification.verification,
      reviewReport: reviewed.reviewReport,
      aiModel: modelUsed,
    });

    sendEvent('complete', { resume: saved });
    res.end();
  } catch (error) {
    console.error('Resume generation pipeline failed:', error);
    sendEvent('error', {
      error:
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during resume generation.',
    });
    res.end();
  }
});

// ---------------------------------------------------------------------------
// GENERATED RESUMES CRUD & FACTUAL RE-VERIFICATION
// ---------------------------------------------------------------------------

app.get('/api/resumes', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await listGeneratedResumesByUserId(req.dbUser!.id);
    res.json({ resumes: items });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list resumes.' });
  }
});

app.get('/api/resumes/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid resume ID.' });
      return;
    }
    const item = await getGeneratedResumeById(id, req.dbUser!.id);
    if (!item) {
      res.status(404).json({ error: 'Resume version not found.' });
      return;
    }
    res.json({ resume: item });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch resume.' });
  }
});

app.put('/api/resumes/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid resume ID.' });
      return;
    }

    const existing = await getGeneratedResumeById(id, req.dbUser!.id);
    if (!existing) {
      res.status(404).json({ error: 'Resume version not found.' });
      return;
    }

    const {
      tailoredResume,
      templateId,
      templateCustomization,
      jobTitle,
      companyName,
    } = req.body as {
      tailoredResume?: TailoredResumeContent;
      templateId?: ResumeTemplateId;
      templateCustomization?: TemplateCustomization | null;
      jobTitle?: string;
      companyName?: string;
    };

    let factualVerification = existing.factualVerification;
    if (tailoredResume) {
      const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
      if (masterRecord) {
        const checked = enforceAndVerifyFactualAccuracy(
          masterRecord.structuredData,
          tailoredResume,
          { autoRestoreImmutable: false },
        );
        factualVerification = checked.verification;
      }
    }

    const updated = await updateGeneratedResumeById({
      id,
      userId: req.dbUser!.id,
      ...(tailoredResume ? { tailoredResume } : {}),
      ...(templateId ? { templateId } : {}),
      ...(templateCustomization !== undefined ? { templateCustomization } : {}),
      ...(jobTitle !== undefined ? { jobTitle } : {}),
      ...(companyName !== undefined ? { companyName } : {}),
      factualVerification,
    });

    res.json({ resume: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update resume.' });
  }
});

app.post('/api/resumes/:id/duplicate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid resume ID.' });
      return;
    }

    const { templateId, templateCustomization, tailoredResume } = req.body as {
      templateId?: ResumeTemplateId;
      templateCustomization?: TemplateCustomization | null;
      tailoredResume?: TailoredResumeContent;
    };

    if (!templateId) {
      res.status(400).json({ error: 'Target templateId is required.' });
      return;
    }

    if (tailoredResume) {
      const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
      if (masterRecord) {
        const check = enforceAndVerifyFactualAccuracy(
          masterRecord.structuredData,
          tailoredResume,
          { autoRestoreImmutable: false },
        );
        if (!check.verification.passed) {
          res.status(422).json({
            error: 'Factual consistency check failed on provided draft.',
            violations: check.verification.violations,
          });
          return;
        }
      }
    }

    const created = await duplicateGeneratedResumeWithTemplate({
      sourceId: id,
      userId: req.dbUser!.id,
      templateId,
      templateCustomization: templateCustomization ?? null,
      tailoredResumeOverride: tailoredResume,
    });

    if (!created) {
      res.status(404).json({ error: 'Source resume version not found.' });
      return;
    }

    res.json({ resume: created });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to duplicate resume version.',
    });
  }
});

app.post('/api/resumes/:id/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid resume ID.' });
      return;
    }
    const existing = await getGeneratedResumeById(id, req.dbUser!.id);
    if (!existing) {
      res.status(404).json({ error: 'Resume version not found.' });
      return;
    }
    const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
    if (!masterRecord) {
      res.status(400).json({ error: 'Master Resume not found.' });
      return;
    }

    const { tailoredResume } = req.body as { tailoredResume?: TailoredResumeContent };
    const candidate = tailoredResume || existing.tailoredResume;

    const checked = enforceAndVerifyFactualAccuracy(masterRecord.structuredData, candidate, {
      autoRestoreImmutable: false,
    });

    res.json({ verification: checked.verification });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Factual verification failed.' });
  }
});

app.post('/api/resumes/:id/explain-keywords', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid resume ID.' });
      return;
    }

    const existing = await getGeneratedResumeById(id, req.dbUser!.id);
    if (!existing) {
      res.status(404).json({ error: 'Resume version not found.' });
      return;
    }

    const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
    if (!masterRecord) {
      res.status(400).json({ error: 'Master Resume not found.' });
      return;
    }

    const explanations = await generateAtsKeywordExplanations(
      masterRecord.structuredData,
      existing.jdAnalysis,
      existing.tailoredResume,
      existing.atsAnalysis,
    );

    const updatedAts = {
      ...existing.atsAnalysis,
      keywordExplanations: explanations,
    };

    const updated = await updateGeneratedResumeById({
      id,
      userId: req.dbUser!.id,
      atsAnalysis: updatedAts,
    });

    res.json({ resume: updated });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to explain ATS keywords.',
    });
  }
});

app.post('/api/resumes/:id/optimize', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid resume ID.' });
      return;
    }

    const { action, currentDraft } = req.body as {
      action?: OptimizationAction;
      currentDraft?: TailoredResumeContent;
    };

    const allowedActions: OptimizationAction[] = [
      'improve_ats',
      'rewrite_summary',
      'optimize_experience',
      'optimize_skills',
    ];
    if (!action || !allowedActions.includes(action)) {
      res.status(400).json({ error: 'Invalid optimization action.' });
      return;
    }

    const existing = await getGeneratedResumeById(id, req.dbUser!.id);
    if (!existing) {
      res.status(404).json({ error: 'Resume version not found.' });
      return;
    }

    const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
    if (!masterRecord) {
      res.status(400).json({ error: 'Master Resume not found.' });
      return;
    }

    const sourceContent = currentDraft || existing.tailoredResume;

    const { improvedResume, improvementsApplied } = await optimizeResumeSection(
      masterRecord.structuredData,
      existing.jdAnalysis,
      sourceContent,
      existing.atsAnalysis,
      action,
    );

    const verified = await runFactualVerificationPipeline(
      masterRecord.structuredData,
      improvedResume,
    );

    let baseline: BaselineAtsScore | undefined;
    if (
      typeof existing.atsAnalysis.originalAtsScore === 'number' &&
      Array.isArray(existing.atsAnalysis.categoryBreakdown) &&
      existing.atsAnalysis.categoryBreakdown.length === 6
    ) {
      baseline = {
        originalAtsScore: existing.atsAnalysis.originalAtsScore,
        categoryScores: existing.atsAnalysis.categoryBreakdown.map((c) => ({
          category: c.category,
          weight: c.weight,
          score: c.originalScore,
          notes: c.notes,
        })),
        formattingIssues: existing.atsAnalysis.formattingIssues || [],
      };
    }

    const updatedAts = await analyzeAtsAlignment(
      masterRecord.structuredData,
      existing.jdAnalysis,
      verified.lockedResume,
      baseline,
    );

    updatedAts.autoImprovementApplied = true;
    updatedAts.autoImprovementNotes = [
      ...(existing.atsAnalysis.autoImprovementNotes || []),
      ...improvementsApplied,
    ];

    const updated = await updateGeneratedResumeById({
      id,
      userId: req.dbUser!.id,
      tailoredResume: verified.lockedResume,
      factualVerification: verified.verification,
      atsAnalysis: updatedAts,
    });

    res.json({ resume: updated, improvementsApplied });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to optimize resume.',
    });
  }
});

app.delete('/api/resumes/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid resume ID.' });
      return;
    }
    const ok = await deleteGeneratedResumeById(id, req.dbUser!.id);
    if (!ok) {
      res.status(404).json({ error: 'Resume version not found.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete resume.' });
  }
});

app.delete('/api/resumes', requireAuth, async (req: AuthRequest, res) => {
  try {
    await deleteAllGeneratedResumesByUserId(req.dbUser!.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to clear history.' });
  }
});

// ---------------------------------------------------------------------------
// PDF & DOCX EXPORT ENDPOINTS (Factual Consistency Check Enforced)
// ---------------------------------------------------------------------------

app.post('/api/export/pdf', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      tailoredResume,
      templateId,
      templateCustomization,
      jobTitle,
      companyName,
    } = req.body as {
      tailoredResume?: TailoredResumeContent;
      templateId?: ResumeTemplateId;
      templateCustomization?: TemplateCustomization | null;
      jobTitle?: string;
      companyName?: string;
    };

    if (!tailoredResume) {
      res.status(400).json({ error: 'Resume data is required for PDF export.' });
      return;
    }

    const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
    if (masterRecord) {
      const check = enforceAndVerifyFactualAccuracy(masterRecord.structuredData, tailoredResume, {
        autoRestoreImmutable: false,
      });
      if (!check.verification.passed) {
        res.status(422).json({
          error:
            'Factual consistency check failed: immutable fields (name, contacts, companies, job titles, dates, education, or certifications) do not match your Master Resume.',
          violations: check.verification.violations,
        });
        return;
      }
    }

    const resolvedTemplate = templateId || 'classic_professional';
    const pdfBuffer = await generateResumePdf(
      tailoredResume,
      resolvedTemplate,
      templateCustomization,
    );
    const validation = await validateResumeExport(
      pdfBuffer,
      'pdf',
      tailoredResume,
      resolvedTemplate,
      templateCustomization,
    );
    const filename = buildResumeDownloadFilename(
      tailoredResume,
      jobTitle || tailoredResume.professionalTitle,
      companyName || 'Company',
      'pdf',
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Download-Filename', filename);
    res.setHeader('X-Export-Validation', JSON.stringify(validation));
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'PDF generation failed.' });
  }
});

app.post('/api/export/docx', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      tailoredResume,
      templateId,
      templateCustomization,
      jobTitle,
      companyName,
    } = req.body as {
      tailoredResume?: TailoredResumeContent;
      templateId?: ResumeTemplateId;
      templateCustomization?: TemplateCustomization | null;
      jobTitle?: string;
      companyName?: string;
    };

    if (!tailoredResume) {
      res.status(400).json({ error: 'Resume data is required for DOCX export.' });
      return;
    }

    const masterRecord = await getMasterResumeByUserId(req.dbUser!.id);
    if (masterRecord) {
      const check = enforceAndVerifyFactualAccuracy(masterRecord.structuredData, tailoredResume, {
        autoRestoreImmutable: false,
      });
      if (!check.verification.passed) {
        res.status(422).json({
          error:
            'Factual consistency check failed: immutable fields do not match your Master Resume.',
          violations: check.verification.violations,
        });
        return;
      }
    }

    const resolvedTemplate = templateId || 'classic_professional';
    const docxBuffer = await generateResumeDocx(
      tailoredResume,
      resolvedTemplate,
      templateCustomization,
    );
    const validation = await validateResumeExport(
      docxBuffer,
      'docx',
      tailoredResume,
      resolvedTemplate,
      templateCustomization,
    );
    const filename = buildResumeDownloadFilename(
      tailoredResume,
      jobTitle || tailoredResume.professionalTitle,
      companyName || 'Company',
      'docx',
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Download-Filename', filename);
    res.setHeader('X-Export-Validation', JSON.stringify(validation));
    res.send(docxBuffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'DOCX generation failed.' });
  }
});

// ---------------------------------------------------------------------------
// GENERATED RESUME STORED FILE DOWNLOAD & TEMPLATES CATALOG
// ---------------------------------------------------------------------------

app.get('/api/resumes/:id/file/:format', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const format = req.params.format === 'docx' ? 'docx' : req.params.format === 'pdf' ? 'pdf' : null;
    if (!Number.isInteger(id) || !format) {
      res.status(400).json({ error: 'Invalid resume ID or file format.' });
      return;
    }

    const record = await getGeneratedResumeById(id, req.dbUser!.id);
    if (!record) {
      res.status(404).json({ error: 'Resume version not found.' });
      return;
    }

    const storedPath = format === 'pdf' ? record.pdfStoragePath : record.docxStoragePath;
    let fileBuffer = storedPath ? await readPrivateFile(storedPath) : null;

    const filename = buildResumeDownloadFilename(
      record.tailoredResume,
      record.jobTitle || record.tailoredResume.professionalTitle,
      record.companyName || 'Company',
      format,
    );

    if (!fileBuffer) {
      fileBuffer =
        format === 'pdf'
          ? await generateResumePdf(
              record.tailoredResume,
              record.templateId,
              record.templateCustomization,
            )
          : await generateResumeDocx(
              record.tailoredResume,
              record.templateId,
              record.templateCustomization,
            );
      const saved = await savePrivateFile(
        `users/${req.dbUser!.id}/generated`,
        filename,
        fileBuffer,
      );
      await updateGeneratedResumeById({
        id: record.id,
        userId: req.dbUser!.id,
        ...(format === 'pdf'
          ? { pdfStoragePath: saved.storagePath }
          : { docxStoragePath: saved.storagePath }),
      });
    }

    res.setHeader(
      'Content-Type',
      format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Download-Filename', filename);
    res.send(fileBuffer);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to retrieve stored resume file.' });
  }
});

app.get('/api/templates', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const templates = await listResumeTemplatesFromDb();
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load templates.' });
  }
});

// ---------------------------------------------------------------------------
// CANDIDATE PROFILE & PRIVATE DOCUMENTS STORAGE
// ---------------------------------------------------------------------------

app.get('/api/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const profile = await getCandidateProfileByUserId(req.dbUser!.id);
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load candidate profile.' });
  }
});

app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const payload = req.body as Record<string, unknown>;
    const updated = await upsertCandidateProfile(req.dbUser!.id, {
      ...(typeof payload.professionalSummary === 'string'
        ? { professionalSummary: payload.professionalSummary }
        : {}),
      ...(typeof payload.totalExperience === 'string'
        ? { totalExperience: payload.totalExperience }
        : {}),
      ...(typeof payload.currentLocation === 'string'
        ? { currentLocation: payload.currentLocation }
        : {}),
      ...(Array.isArray(payload.preferredLocations)
        ? { preferredLocations: payload.preferredLocations.map(String) }
        : {}),
      ...(Array.isArray(payload.preferredJobTitles)
        ? { preferredJobTitles: payload.preferredJobTitles.map(String) }
        : {}),
      ...(typeof payload.preferredSalary === 'string'
        ? { preferredSalary: payload.preferredSalary }
        : {}),
      ...(typeof payload.noticePeriod === 'string' ? { noticePeriod: payload.noticePeriod } : {}),
      ...(typeof payload.joiningAvailability === 'string'
        ? { joiningAvailability: payload.joiningAvailability }
        : {}),
      ...(Array.isArray(payload.technicalSkills)
        ? { technicalSkills: payload.technicalSkills.map(String) }
        : {}),
      ...(Array.isArray(payload.softwareSkills)
        ? { softwareSkills: payload.softwareSkills.map(String) }
        : {}),
      ...(Array.isArray(payload.achievements)
        ? { achievements: payload.achievements.map(String) }
        : {}),
    });

    await recordAuditLog({
      userId: req.dbUser!.id,
      actionType: 'CANDIDATE_PROFILE_UPDATED',
      entityType: 'candidate_profiles',
      entityId: updated.id,
      actionDetails: { totalExperience: updated.totalExperience, currentLocation: updated.currentLocation },
    });

    res.json({ profile: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update candidate profile.' });
  }
});

app.get('/api/documents', requireAuth, async (req: AuthRequest, res) => {
  try {
    const documents = await listCandidateDocumentsByUserId(req.dbUser!.id);
    res.json({ documents });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load documents.' });
  }
});

app.post(
  '/api/documents',
  requireAuth,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message || 'Document upload failed.' });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Please upload a PDF, DOCX, or TXT document.' });
        return;
      }
      const documentType =
        typeof req.body?.documentType === 'string' && req.body.documentType.trim()
          ? req.body.documentType.trim()
          : 'supporting_document';

      let extractedText = '';
      try {
        extractedText = await extractTextFromJdFile(
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname,
        );
      } catch {
        extractedText = '';
      }

      const stored = await savePrivateFile(
        `users/${req.dbUser!.id}/uploads`,
        req.file.originalname,
        req.file.buffer,
      );
      const fileFormat = req.file.originalname.split('.').pop()?.toLowerCase() || 'pdf';
      const document = await createCandidateDocument({
        userId: req.dbUser!.id,
        documentName: req.file.originalname,
        documentType,
        storagePath: stored.storagePath,
        fileFormat,
        fileSize: stored.sizeBytes,
        isMasterResume: false,
        extractedText,
      });

      res.status(201).json({ document });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to store document.' });
    }
  },
);

app.get('/api/documents/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const doc = await getCandidateDocumentById(id, req.dbUser!.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain; charset=utf-8',
    };
    const mimeType = mimeMap[doc.fileFormat.toLowerCase()] || 'application/octet-stream';

    if (req.query.mode === 'signed_url') {
      const token = createSignedStorageToken({
        userId: req.dbUser!.id,
        storagePath: doc.storagePath,
        fileName: doc.documentName,
        mimeType,
      });
      res.json({ signedUrl: `/api/storage/signed?token=${encodeURIComponent(token)}`, fileName: doc.documentName });
      return;
    }

    const fileBuf = await readPrivateFile(doc.storagePath);
    if (!fileBuf) {
      res.status(404).json({ error: 'Stored file missing on disk.' });
      return;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.documentName}"`);
    res.send(fileBuf);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to download document.' });
  }
});

app.get('/api/storage/signed', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const verified = token ? verifySignedStorageToken(token) : null;
    if (!verified) {
      res.status(403).json({ error: 'Invalid or expired signed storage URL.' });
      return;
    }
    const buf = await readPrivateFile(verified.storagePath);
    if (!buf) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    res.setHeader('Content-Type', verified.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${verified.fileName}"`);
    res.send(buf);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to serve signed file.' });
  }
});

app.delete('/api/documents/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const deleted = await deleteCandidateDocumentById(id, req.dbUser!.id);
    if (!deleted) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    await deletePrivateFile(deleted.storagePath);
    await recordAuditLog({
      userId: req.dbUser!.id,
      actionType: 'DOCUMENT_DELETED',
      entityType: 'candidate_documents',
      entityId: id,
      actionDetails: { documentName: deleted.documentName },
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete document.' });
  }
});

// ---------------------------------------------------------------------------
// SAVED JOB DESCRIPTIONS, JOBS, RECRUITERS, APPLICATIONS & EMAIL LOGS
// ---------------------------------------------------------------------------

app.get('/api/job-descriptions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const jobDescriptions = await listJobDescriptionsByUserId(req.dbUser!.id);
    res.json({ jobDescriptions });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load job descriptions.' });
  }
});

app.get('/api/jobs', requireAuth, async (_req: AuthRequest, res) => {
  try {
    const jobListings = await listJobListings();
    res.json({ jobs: jobListings });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load jobs.' });
  }
});

app.post('/api/jobs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body as {
      companyName?: string;
      jobTitle?: string;
      location?: string;
      jobDescription?: string;
      jobUrl?: string;
      source?: string;
      employmentType?: string;
      experienceRequired?: string;
      salaryRange?: string;
    };
    if (!body.companyName?.trim() || !body.jobTitle?.trim()) {
      res.status(400).json({ error: 'Company name and job title are required.' });
      return;
    }
    const job = await upsertJobListing({
      companyName: body.companyName.trim(),
      jobTitle: body.jobTitle.trim(),
      location: body.location?.trim() || '',
      jobDescription: body.jobDescription?.trim() || '',
      jobUrl: body.jobUrl?.trim() || '',
      source: body.source?.trim() || 'manual',
      employmentType: body.employmentType?.trim() || '',
      experienceRequired: body.experienceRequired?.trim() || '',
      salaryRange: body.salaryRange?.trim() || '',
    });
    await recordAuditLog({
      userId: req.dbUser!.id,
      actionType: 'JOB_SAVED',
      entityType: 'jobs',
      entityId: job.id,
      actionDetails: { companyName: job.companyName, jobTitle: job.jobTitle },
    });
    res.status(201).json({ job });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save job.' });
  }
});

app.get('/api/recruiters', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await listRecruitersByUserId(req.dbUser!.id);
    res.json({ recruiters: items });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load recruiters.' });
  }
});

app.post('/api/recruiters', requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body as {
      companyName?: string;
      recruiterName?: string;
      designation?: string;
      professionalEmail?: string;
      linkedinUrl?: string;
      contactSource?: string;
      verificationStatus?: 'verified' | 'unverified' | 'bounced';
    };
    if (!body.companyName?.trim() || !body.recruiterName?.trim()) {
      res.status(400).json({ error: 'Company name and recruiter name are required.' });
      return;
    }
    const recruiter = await createRecruiterRecord({
      userId: req.dbUser!.id,
      companyName: body.companyName.trim(),
      recruiterName: body.recruiterName.trim(),
      designation: body.designation?.trim() || '',
      professionalEmail: body.professionalEmail?.trim() || '',
      linkedinUrl: body.linkedinUrl?.trim() || '',
      contactSource: body.contactSource?.trim() || 'user_provided',
      verificationStatus: body.verificationStatus ?? 'unverified',
    });
    res.status(201).json({ recruiter });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save recruiter.' });
  }
});

app.put('/api/recruiters/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const updated = await updateRecruiterById(String(req.params.id), req.dbUser!.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Recruiter contact not found.' });
      return;
    }
    res.json({ recruiter: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update recruiter.' });
  }
});

app.delete('/api/recruiters/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const ok = await deleteRecruiterById(String(req.params.id), req.dbUser!.id);
    if (!ok) {
      res.status(404).json({ error: 'Recruiter contact not found.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete recruiter.' });
  }
});

app.get('/api/applications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await listApplicationsByUserId(req.dbUser!.id);
    res.json({ applications: items });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load applications.' });
  }
});

app.post('/api/applications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body as {
      jobId?: string | null;
      recruiterId?: string | null;
      generatedResumeId?: number | null;
      companyName?: string;
      jobTitle?: string;
      applicationStatus?: ApplicationStatus;
      applicationMethod?: string;
      recipientEmail?: string;
      emailSubject?: string;
      applicationUrl?: string;
      followUpDate?: string | null;
      notes?: string;
    };
    if (!body.companyName?.trim() || !body.jobTitle?.trim()) {
      res.status(400).json({ error: 'Company name and job title are required.' });
      return;
    }
    if (
      body.applicationStatus &&
      !APPLICATION_STATUSES.includes(body.applicationStatus)
    ) {
      res.status(400).json({ error: 'Invalid application status value.' });
      return;
    }
    const application = await createApplicationRecord({
      userId: req.dbUser!.id,
      jobId: body.jobId ?? null,
      recruiterId: body.recruiterId ?? null,
      generatedResumeId: body.generatedResumeId ?? null,
      companyName: body.companyName.trim(),
      jobTitle: body.jobTitle.trim(),
      applicationStatus: body.applicationStatus ?? 'Resume Generated',
      applicationMethod: body.applicationMethod ?? 'portal',
      recipientEmail: body.recipientEmail?.trim() || '',
      emailSubject: body.emailSubject?.trim() || '',
      applicationUrl: body.applicationUrl?.trim() || '',
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
      notes: body.notes ?? '',
    });
    res.status(201).json({ application });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create application.' });
  }
});

app.put('/api/applications/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.applicationStatus === 'string' &&
      !APPLICATION_STATUSES.includes(body.applicationStatus as ApplicationStatus)
    ) {
      res.status(400).json({ error: 'Invalid application status value.' });
      return;
    }
    const updated = await updateApplicationById(String(req.params.id), req.dbUser!.id, {
      ...(body.recruiterId !== undefined ? { recruiterId: (body.recruiterId as string | null) } : {}),
      ...(body.generatedResumeId !== undefined
        ? { generatedResumeId: (body.generatedResumeId as number | null) }
        : {}),
      ...(typeof body.applicationStatus === 'string'
        ? { applicationStatus: body.applicationStatus as ApplicationStatus }
        : {}),
      ...(typeof body.applicationMethod === 'string'
        ? { applicationMethod: body.applicationMethod }
        : {}),
      ...(typeof body.recipientEmail === 'string' ? { recipientEmail: body.recipientEmail } : {}),
      ...(typeof body.emailSubject === 'string' ? { emailSubject: body.emailSubject } : {}),
      ...(typeof body.applicationUrl === 'string' ? { applicationUrl: body.applicationUrl } : {}),
      ...(body.followUpDate !== undefined
        ? { followUpDate: body.followUpDate ? new Date(String(body.followUpDate)) : null }
        : {}),
      ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
    });
    if (!updated) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }
    res.json({ application: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update application.' });
  }
});

app.delete('/api/applications/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const ok = await deleteApplicationById(String(req.params.id), req.dbUser!.id);
    if (!ok) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete application.' });
  }
});

app.get('/api/emails', requireAuth, async (req: AuthRequest, res) => {
  try {
    const emails = await listEmailMessagesByUserId(req.dbUser!.id);
    res.json({ emails });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load email activity.' });
  }
});

app.post('/api/applications/:id/emails', requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body as {
      emailProvider?: string;
      externalMessageId?: string;
      senderEmail?: string;
      recipientEmail?: string;
      subject?: string;
      messageType?: string;
      messageStatus?: string;
      classification?: string;
      markApplicationSent?: boolean;
    };
    if (!body.recipientEmail?.trim() || !body.subject?.trim()) {
      res.status(400).json({ error: 'Recipient email and subject are required.' });
      return;
    }
    const email = await recordConfirmedEmailMessage({
      userId: req.dbUser!.id,
      applicationId: String(req.params.id),
      emailProvider: body.emailProvider || 'gmail',
      externalMessageId: body.externalMessageId || '',
      senderEmail: body.senderEmail?.trim() || req.dbUser!.email,
      recipientEmail: body.recipientEmail.trim(),
      subject: body.subject.trim(),
      messageType: body.messageType || 'outbound',
      messageStatus: body.messageStatus || 'sent',
      classification: body.classification || 'application',
      markApplicationSent: body.markApplicationSent ?? true,
    });
    if (!email) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }
    res.status(201).json({ email });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to record email message.' });
  }
});

// ---------------------------------------------------------------------------
// JOB PREFERENCES, AUTOMATION RUNS, AUDIT LOGS & ADMIN OVERVIEW
// ---------------------------------------------------------------------------

app.get('/api/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const preferences = await getOrCreateJobPreferences(req.dbUser!.id);
    res.json({ preferences });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load job preferences.' });
  }
});

app.put('/api/preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const preferences = await upsertJobPreferences(req.dbUser!.id, req.body);
    await recordAuditLog({
      userId: req.dbUser!.id,
      actionType: 'JOB_PREFERENCES_UPDATED',
      entityType: 'job_preferences',
      entityId: preferences.id,
      actionDetails: {
        dailySearchEnabled: preferences.dailySearchEnabled,
        minimumAtsScore: preferences.minimumAtsScore,
      },
    });
    res.json({ preferences });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save job preferences.' });
  }
});

app.get('/api/automation/runs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const runs = await listAutomationRunsByUserId(req.dbUser!.id);
    res.json({ runs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load automation runs.' });
  }
});

app.post('/api/automation/run', requireAuth, async (req: AuthRequest, res) => {
  try {
    const run = await executeUserAutomationRun(req.dbUser!.id);
    res.status(201).json({ run });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to run automation cycle.' });
  }
});

app.get('/api/audit-logs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const logs = await listAuditLogsByUserId(req.dbUser!.id);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load audit logs.' });
  }
});

app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const overview = await getAdminDatabaseOverview();
    res.json({ overview });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load admin overview.' });
  }
});

// ---------------------------------------------------------------------------
// VITE DEV MIDDLEWARE / PRODUCTION STATIC SERVING
// ---------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ResumeAI server listening on http://0.0.0.0:${PORT}`);
    void syncResumeTemplatesCatalog().catch((err) => {
      console.error('Deferred template catalog sync warning:', err);
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
