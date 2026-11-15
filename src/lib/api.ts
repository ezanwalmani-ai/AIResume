import type {
  ExportValidationReport,
  FactualVerificationResult,
  GeneratedResumeRecord,
  GenerationMode,
  JobDescriptionAnalysis,
  MasterResumeData,
  MasterResumeRecord,
  OptimizationAction,
  ResumeTemplateId,
  TailoredResumeContent,
  TemplateCustomization,
  UserSettings,
} from '../types/resume.ts';
import type {
  AdminOverviewStats,
  ApplicationRecord,
  ApplicationStatus,
  AuditLogRecord,
  AutomationRunRecord,
  CandidateDocumentRecord,
  CandidateProfileRecord,
  EmailMessageRecord,
  JobDescriptionDbRecord,
  JobListingRecord,
  JobPreferencesRecord,
  RecruiterRecord,
  ResumeTemplateDbRecord,
} from '../types/database.ts';

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    return json.error || `Request failed with status ${res.status}`;
  } catch {
    return `Request failed with status ${res.status}`;
  }
}

export async function apiGetMe(token: string): Promise<UserSettings> {
  const res = await fetch('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json() as Promise<UserSettings>;
}

export async function apiUpdateSettings(
  token: string,
  prefs: Partial<
    Pick<UserSettings, 'defaultMode' | 'defaultTemplate' | 'displayName' | 'fullName' | 'phone'>
  >,
): Promise<UserSettings> {
  const res = await fetch('/api/me/settings', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json() as Promise<UserSettings>;
}

export async function apiDeleteAccountData(token: string): Promise<void> {
  const res = await fetch('/api/me/account-data', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
}

export async function apiGetMasterResume(
  token: string,
): Promise<MasterResumeRecord | null> {
  const res = await fetch('/api/master-resume', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { masterResume: MasterResumeRecord | null };
  return data.masterResume;
}

export async function apiExtractMasterResumeFile(
  token: string,
  file: File,
): Promise<{ masterResume: MasterResumeRecord; modelUsed: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/master-resume/extract', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json() as Promise<{ masterResume: MasterResumeRecord; modelUsed: string }>;
}

export async function apiExtractMasterResumeText(
  token: string,
  rawText: string,
): Promise<{ masterResume: MasterResumeRecord; modelUsed: string }> {
  const res = await fetch('/api/master-resume/extract', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rawText }),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json() as Promise<{ masterResume: MasterResumeRecord; modelUsed: string }>;
}

export async function apiSaveMasterResume(
  token: string,
  structuredData: MasterResumeData,
  isApproved: boolean,
): Promise<MasterResumeRecord> {
  const res = await fetch('/api/master-resume', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredData, isApproved }),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { masterResume: MasterResumeRecord };
  return data.masterResume;
}

export async function apiDeleteMasterResume(token: string): Promise<void> {
  const res = await fetch('/api/master-resume', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
}

export async function apiExtractJdFile(
  token: string,
  file: File,
): Promise<{ jdText: string; jdAnalysis: JobDescriptionAnalysis; jobDescriptionId?: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/jd/extract', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json() as Promise<{
    jdText: string;
    jdAnalysis: JobDescriptionAnalysis;
    jobDescriptionId?: string;
  }>;
}

export async function apiAnalyzeJd(
  token: string,
  jobDescription: string,
): Promise<{ jdAnalysis: JobDescriptionAnalysis; jobDescriptionId?: string }> {
  const res = await fetch('/api/jd/analyze', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobDescription }),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json() as Promise<{
    jdAnalysis: JobDescriptionAnalysis;
    jobDescriptionId?: string;
  }>;
}

export interface GenerationProgressEvent {
  step: number;
  total: number;
  label: string;
}

export async function apiGenerateTailoredResume(
  token: string,
  params: {
    jobDescription: string;
    jobDescriptionId?: string;
    mode: GenerationMode;
    templateId: ResumeTemplateId;
    templateCustomization?: TemplateCustomization | null;
    companyOverride?: string;
    jobTitleOverride?: string;
    precomputedJdAnalysis?: JobDescriptionAnalysis;
  },
  onProgress: (progress: GenerationProgressEvent) => void,
): Promise<GeneratedResumeRecord> {
  const res = await fetch('/api/resumes/generate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Server did not return a valid generation stream.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResume: GeneratedResumeRecord | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const lines = block.split('\n');
      let eventType = 'message';
      let dataLine = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLine += line.slice(5).trim();
        }
      }
      if (!dataLine) continue;

      const parsed = JSON.parse(dataLine) as Record<string, unknown>;
      if (eventType === 'progress') {
        onProgress(parsed as unknown as GenerationProgressEvent);
      } else if (eventType === 'error') {
        throw new Error(String(parsed.error || 'Resume generation failed.'));
      } else if (eventType === 'complete') {
        finalResume = parsed.resume as GeneratedResumeRecord;
      }
    }
  }

  if (!finalResume) {
    throw new Error('Generation stream ended without returning a resume.');
  }

  return finalResume;
}

export async function apiListResumes(token: string): Promise<GeneratedResumeRecord[]> {
  const res = await fetch('/api/resumes', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { resumes: GeneratedResumeRecord[] };
  return data.resumes;
}

export async function apiUpdateResume(
  token: string,
  id: number,
  updates: {
    tailoredResume?: TailoredResumeContent;
    templateId?: ResumeTemplateId;
    templateCustomization?: TemplateCustomization | null;
    jobTitle?: string;
    companyName?: string;
  },
): Promise<GeneratedResumeRecord> {
  const res = await fetch(`/api/resumes/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { resume: GeneratedResumeRecord };
  return data.resume;
}

export async function apiDuplicateResumeWithTemplate(
  token: string,
  id: number,
  params: {
    templateId: ResumeTemplateId;
    templateCustomization?: TemplateCustomization | null;
    tailoredResume?: TailoredResumeContent;
  },
): Promise<GeneratedResumeRecord> {
  const res = await fetch(`/api/resumes/${id}/duplicate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { resume: GeneratedResumeRecord };
  return data.resume;
}

export async function apiVerifyResume(
  token: string,
  id: number,
  tailoredResume: TailoredResumeContent,
): Promise<FactualVerificationResult> {
  const res = await fetch(`/api/resumes/${id}/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tailoredResume }),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { verification: FactualVerificationResult };
  return data.verification;
}

export async function apiExplainAtsKeywords(
  token: string,
  id: number,
): Promise<GeneratedResumeRecord> {
  const res = await fetch(`/api/resumes/${id}/explain-keywords`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { resume: GeneratedResumeRecord };
  return data.resume;
}

export async function apiOptimizeResume(
  token: string,
  id: number,
  action: OptimizationAction,
  currentDraft?: TailoredResumeContent,
): Promise<{ resume: GeneratedResumeRecord; improvementsApplied: string[] }> {
  const res = await fetch(`/api/resumes/${id}/optimize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, currentDraft }),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  return res.json() as Promise<{ resume: GeneratedResumeRecord; improvementsApplied: string[] }>;
}

export async function apiDeleteResume(token: string, id: number): Promise<void> {
  const res = await fetch(`/api/resumes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
}

export async function apiDeleteAllResumes(token: string): Promise<void> {
  const res = await fetch('/api/resumes', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
}

export async function apiDownloadExport(
  token: string,
  format: 'pdf' | 'docx',
  payload: {
    tailoredResume: TailoredResumeContent;
    templateId: ResumeTemplateId;
    templateCustomization?: TemplateCustomization | null;
    jobTitle: string;
    companyName: string;
  },
): Promise<{ blob: Blob; filename: string; validation: ExportValidationReport | null }> {
  const res = await fetch(`/api/export/${format}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  const blob = await res.blob();
  const headerName = res.headers.get('X-Download-Filename');
  const rawValidation = res.headers.get('X-Export-Validation');
  let validation: ExportValidationReport | null = null;
  if (rawValidation) {
    try {
      validation = JSON.parse(rawValidation) as ExportValidationReport;
    } catch {
      validation = null;
    }
  }
  const fallback = `Resume.${format}`;
  return { blob, filename: headerName || fallback, validation };
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// CANDIDATE PROFILE, PRIVATE DOCUMENTS, JOBS, APPLICATIONS & ADMIN API
// ---------------------------------------------------------------------------

export async function apiGetProfile(token: string): Promise<CandidateProfileRecord | null> {
  const res = await fetch('/api/profile', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { profile: CandidateProfileRecord | null };
  return data.profile;
}

export async function apiUpdateProfile(
  token: string,
  updates: Partial<CandidateProfileRecord>,
): Promise<CandidateProfileRecord> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { profile: CandidateProfileRecord };
  return data.profile;
}

export async function apiListDocuments(token: string): Promise<CandidateDocumentRecord[]> {
  const res = await fetch('/api/documents', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { documents: CandidateDocumentRecord[] };
  return data.documents;
}

export async function apiUploadDocument(
  token: string,
  file: File,
  documentType = 'supporting_document',
): Promise<CandidateDocumentRecord> {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { document: CandidateDocumentRecord };
  return data.document;
}

export async function apiDownloadDocument(
  token: string,
  id: string,
): Promise<{ blob: Blob; fileName: string }> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const blob = await res.blob();
  const disp = res.headers.get('Content-Disposition') || '';
  const match = disp.match(/filename="([^"]+)"/);
  return { blob, fileName: match?.[1] || 'document' };
}

export async function apiDeleteDocument(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
}

export async function apiDownloadStoredResumeFile(
  token: string,
  id: number,
  format: 'pdf' | 'docx',
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/resumes/${id}/file/${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const blob = await res.blob();
  const filename = res.headers.get('X-Download-Filename') || `Resume.${format}`;
  return { blob, filename };
}

export async function apiListTemplates(token: string): Promise<ResumeTemplateDbRecord[]> {
  const res = await fetch('/api/templates', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { templates: ResumeTemplateDbRecord[] };
  return data.templates;
}

export async function apiListJobDescriptions(token: string): Promise<JobDescriptionDbRecord[]> {
  const res = await fetch('/api/job-descriptions', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { jobDescriptions: JobDescriptionDbRecord[] };
  return data.jobDescriptions;
}

export async function apiListJobs(token: string): Promise<JobListingRecord[]> {
  const res = await fetch('/api/jobs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { jobs: JobListingRecord[] };
  return data.jobs;
}

export async function apiCreateJob(
  token: string,
  payload: {
    companyName: string;
    jobTitle: string;
    location?: string;
    jobDescription?: string;
    jobUrl?: string;
    source?: string;
    employmentType?: string;
    experienceRequired?: string;
    salaryRange?: string;
  },
): Promise<JobListingRecord> {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { job: JobListingRecord };
  return data.job;
}

export async function apiListRecruiters(token: string): Promise<RecruiterRecord[]> {
  const res = await fetch('/api/recruiters', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { recruiters: RecruiterRecord[] };
  return data.recruiters;
}

export async function apiCreateRecruiter(
  token: string,
  payload: {
    companyName: string;
    recruiterName: string;
    designation?: string;
    professionalEmail?: string;
    linkedinUrl?: string;
    contactSource?: string;
    verificationStatus?: 'verified' | 'unverified' | 'bounced';
  },
): Promise<RecruiterRecord> {
  const res = await fetch('/api/recruiters', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { recruiter: RecruiterRecord };
  return data.recruiter;
}

export async function apiDeleteRecruiter(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/recruiters/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
}

export async function apiListApplications(token: string): Promise<ApplicationRecord[]> {
  const res = await fetch('/api/applications', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { applications: ApplicationRecord[] };
  return data.applications;
}

export async function apiCreateApplication(
  token: string,
  payload: {
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
    followUpDate?: string | null;
    notes?: string;
  },
): Promise<ApplicationRecord> {
  const res = await fetch('/api/applications', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { application: ApplicationRecord };
  return data.application;
}

export async function apiUpdateApplication(
  token: string,
  id: string,
  updates: Partial<{
    recruiterId: string | null;
    generatedResumeId: number | null;
    applicationStatus: ApplicationStatus;
    applicationMethod: string;
    recipientEmail: string;
    emailSubject: string;
    applicationUrl: string;
    followUpDate: string | null;
    notes: string;
  }>,
): Promise<ApplicationRecord> {
  const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { application: ApplicationRecord };
  return data.application;
}

export async function apiDeleteApplication(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
}

export async function apiListEmails(token: string): Promise<EmailMessageRecord[]> {
  const res = await fetch('/api/emails', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { emails: EmailMessageRecord[] };
  return data.emails;
}

export async function apiRecordApplicationEmail(
  token: string,
  applicationId: string,
  payload: {
    emailProvider?: string;
    senderEmail?: string;
    recipientEmail: string;
    subject: string;
    messageType?: string;
    messageStatus?: string;
    classification?: string;
    markApplicationSent?: boolean;
  },
): Promise<EmailMessageRecord> {
  const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { email: EmailMessageRecord };
  return data.email;
}

export async function apiGetJobPreferences(token: string): Promise<JobPreferencesRecord> {
  const res = await fetch('/api/preferences', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { preferences: JobPreferencesRecord };
  return data.preferences;
}

export async function apiUpdateJobPreferences(
  token: string,
  updates: Partial<JobPreferencesRecord>,
): Promise<JobPreferencesRecord> {
  const res = await fetch('/api/preferences', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { preferences: JobPreferencesRecord };
  return data.preferences;
}

export async function apiListAutomationRuns(token: string): Promise<AutomationRunRecord[]> {
  const res = await fetch('/api/automation/runs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { runs: AutomationRunRecord[] };
  return data.runs;
}

export async function apiTriggerAutomationRun(token: string): Promise<AutomationRunRecord> {
  const res = await fetch('/api/automation/run', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { run: AutomationRunRecord };
  return data.run;
}

export async function apiListAuditLogs(token: string): Promise<AuditLogRecord[]> {
  const res = await fetch('/api/audit-logs', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { logs: AuditLogRecord[] };
  return data.logs;
}

export async function apiGetAdminOverview(token: string): Promise<AdminOverviewStats> {
  const res = await fetch('/api/admin/overview', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseErrorResponse(res));
  const data = (await res.json()) as { overview: AdminOverviewStats };
  return data.overview;
}
