import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  FileUp,
  FileWarning,
  Layers,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  apiAnalyzeJd,
  apiExtractJdFile,
  apiGenerateTailoredResume,
  type GenerationProgressEvent,
} from '../lib/api.ts';
import {
  getTemplateDefinition,
  normalizeTemplateId,
  resolveTemplateCustomization,
} from '../lib/templates.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type {
  GeneratedResumeRecord,
  GenerationMode,
  JobDescriptionAnalysis,
  MasterResumeRecord,
  ResumeTemplateId,
  TemplateCustomization,
} from '../types/resume.ts';
import { ResumeDocumentPreview } from './ResumeDocumentPreview.tsx';
import { TemplateSelector } from './TemplateSelector.tsx';

interface GenerateResumeViewProps {
  masterResume: MasterResumeRecord | null;
  defaultMode: GenerationMode;
  defaultTemplate: ResumeTemplateId;
  initialCustomization?: TemplateCustomization | null;
  initialJobDescription?: string;
  activeResume: GeneratedResumeRecord | null;
  onGenerated: (record: GeneratedResumeRecord) => void;
  onUpdated: (record: GeneratedResumeRecord) => void;
  onSavedAsNewVersion: (record: GeneratedResumeRecord) => void;
  onClearActive: () => void;
  onNavigateMaster: () => void;
  onNavigateAts: (record: GeneratedResumeRecord) => void;
  onOpenTemplatesLibrary: () => void;
  onTrackApplication?: (applicationId: string) => void;
}

const MODE_OPTIONS: Array<{
  id: GenerationMode;
  title: string;
  description: string;
}> = [
  {
    id: 'balanced',
    title: 'Balanced Resume',
    description:
      'Natural, executive balance across verified experience with strong, truthful JD alignment.',
  },
  {
    id: 'maximum_alignment',
    title: 'Maximum JD Alignment',
    description:
      'Prioritizes JD-relevant responsibilities first and naturally weaves supported JD terminology.',
  },
  {
    id: 'conservative',
    title: 'Conservative Resume',
    description:
      'Minimal edits to your Master Resume while refining clarity, action verbs, and ATS readability.',
  },
];

export function GenerateResumeView({
  masterResume,
  defaultMode,
  defaultTemplate,
  initialCustomization,
  initialJobDescription,
  activeResume,
  onGenerated,
  onUpdated,
  onSavedAsNewVersion,
  onClearActive,
  onNavigateMaster,
  onNavigateAts,
  onOpenTemplatesLibrary,
  onTrackApplication,
}: GenerateResumeViewProps) {
  const { getToken } = useAuth();
  const jdFileInputRef = useRef<HTMLInputElement | null>(null);

  const [jobDescription, setJobDescription] = useState(
    activeResume?.originalJd ?? initialJobDescription ?? '',
  );
  const [jobDescriptionId, setJobDescriptionId] = useState<string | undefined>(
    activeResume?.jobDescriptionId ?? undefined,
  );
  const [jdAnalysis, setJdAnalysis] = useState<JobDescriptionAnalysis | null>(
    activeResume?.jdAnalysis ?? null,
  );
  const [uploadedJdName, setUploadedJdName] = useState<string | null>(null);
  const [analyzingJd, setAnalyzingJd] = useState(false);

  const [jobTitleOverride, setJobTitleOverride] = useState('');
  const [companyOverride, setCompanyOverride] = useState('');
  const [mode, setMode] = useState<GenerationMode>(defaultMode);
  const [templateId, setTemplateId] = useState<ResumeTemplateId>(() =>
    normalizeTemplateId(defaultTemplate),
  );
  const [templateCustomization, setTemplateCustomization] = useState<TemplateCustomization>(() =>
    resolveTemplateCustomization(defaultTemplate, initialCustomization),
  );
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalized = normalizeTemplateId(defaultTemplate);
    setTemplateId(normalized);
    setTemplateCustomization(resolveTemplateCustomization(normalized, initialCustomization));
  }, [defaultTemplate, initialCustomization]);

  const handleSelectTemplate = (id: ResumeTemplateId) => {
    const normalized = normalizeTemplateId(id);
    setTemplateId(normalized);
    setTemplateCustomization(resolveTemplateCustomization(normalized));
  };

  const handleJdFileUpload = async (file: File) => {
    setError(null);
    setAnalyzingJd(true);
    setUploadedJdName(file.name);
    try {
      const token = await getToken();
      const result = await apiExtractJdFile(token, file);
      setJobDescription(result.jdText);
      setJobDescriptionId(result.jobDescriptionId);
      setJdAnalysis(result.jdAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract Job Description file.');
    } finally {
      setAnalyzingJd(false);
    }
  };

  const handleAnalyzeJd = async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 30) {
      setError('Please paste or upload a job description (at least 30 characters) first.');
      return;
    }
    setError(null);
    setAnalyzingJd(true);
    try {
      const token = await getToken();
      const result = await apiAnalyzeJd(token, jobDescription.trim());
      setJobDescriptionId(result.jobDescriptionId);
      setJdAnalysis(result.jdAnalysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze job description.');
    } finally {
      setAnalyzingJd(false);
    }
  };

  const handleGenerate = async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 30) {
      setError('Please paste or upload the full job description (at least 30 characters).');
      return;
    }

    setError(null);
    setGenerating(true);
    setProgress({
      step: 1,
      total: 8,
      label: 'Initializing proactive AI resume optimization pipeline...',
    });

    try {
      const token = await getToken();
      const result = await apiGenerateTailoredResume(
        token,
        {
          jobDescription: jobDescription.trim(),
          jobDescriptionId,
          mode,
          templateId,
          templateCustomization,
          companyOverride: companyOverride.trim() || undefined,
          jobTitleOverride: jobTitleOverride.trim() || undefined,
          precomputedJdAnalysis: jdAnalysis || undefined,
        },
        (evt) => setProgress(evt),
      );
      onGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resume generation failed. Please retry.');
    } finally {
      setGenerating(false);
    }
  };

  if (!masterResume) {
    return (
      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-8 space-y-4">
        <div className="flex items-center gap-3 text-slate-900">
          <FileWarning className="w-6 h-6 text-amber-600" />
          <h1 className="text-xl font-bold tracking-tight">Master Resume Required</h1>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Upload and save your permanent Master Resume once before generating tailored resumes.
          Every tailored version pulls strictly from your verified Master Resume without ever
          modifying it.
        </p>
        <button
          type="button"
          onClick={onNavigateMaster}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          Go to My Master Resume
        </button>
      </div>
    );
  }

  if (activeResume && !generating) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <button
              type="button"
              onClick={onClearActive}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 mb-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>New Job Description</span>
            </button>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {activeResume.jobTitle} — {activeResume.companyName}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Version {activeResume.version} · Mode: {activeResume.generationMode.replace('_', ' ')} ·
              Generated {new Date(activeResume.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <ResumeDocumentPreview
          key={activeResume.id}
          record={activeResume}
          masterData={masterResume.structuredData}
          onUpdated={onUpdated}
          onRegenerated={onGenerated}
          onSavedAsNewVersion={onSavedAsNewVersion}
          onViewAtsAnalysis={() => onNavigateAts(activeResume)}
          onOpenTemplatesLibrary={onOpenTemplatesLibrary}
          onTrackApplication={onTrackApplication}
        />
      </div>
    );
  }

  const essentialList = jdAnalysis
    ? jdAnalysis.essentialRequirements?.length
      ? jdAnalysis.essentialRequirements
      : jdAnalysis.mandatoryRequirements
    : [];

  const templateRec = jdAnalysis?.templateRecommendation;
  const recommendedDef = templateRec
    ? getTemplateDefinition(templateRec.recommendedTemplateId)
    : null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Proactive AI Resume Generator & ATS Optimizer
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Using permanent Master Resume for{' '}
          <span className="font-semibold text-slate-900">
            {masterResume.structuredData.personalInfo.fullName}
          </span>{' '}
          (v{masterResume.version}). Analyze the job description first to inspect extracted
          requirements, skills, and industry terminology before generating your tailored resume.
        </p>
      </div>

      {/* Card 1: Job Description Input & Upload */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className="text-sm font-semibold text-slate-900">
              1. Paste or Upload Target Job Description
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Supports pasted job postings or PDF, DOCX, and TXT uploads.
              {uploadedJdName ? ` Loaded file: ${uploadedJdName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs text-slate-500 tabular-nums">
              {jobDescription.length} characters
            </span>
            <input
              ref={jdFileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleJdFileUpload(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={analyzingJd || generating}
              onClick={() => jdFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileUp className="w-3.5 h-3.5 text-blue-600" />
              <span>{analyzingJd ? 'Reading File...' : 'Upload JD (PDF/DOCX/TXT)'}</span>
            </button>
            <button
              type="button"
              disabled={analyzingJd || generating || jobDescription.trim().length < 30}
              onClick={() => void handleAnalyzeJd()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
            >
              {analyzingJd ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSearch className="w-3.5 h-3.5" />
              )}
              <span>{analyzingJd ? 'Analyzing JD...' : 'Analyze Job Description'}</span>
            </button>
          </div>
        </div>

        <textarea
          rows={9}
          value={jobDescription}
          onChange={(e) => {
            setJobDescription(e.target.value);
            if (jdAnalysis) setJdAnalysis(null);
            if (jobDescriptionId) setJobDescriptionId(undefined);
          }}
          disabled={generating || analyzingJd}
          placeholder="Paste the complete job description here (role summary, responsibilities, mandatory & preferred qualifications, ERP/software tools, industry terms)..."
          className="w-full rounded-lg border border-slate-200 p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Target Job Title (optional override)
            </label>
            <input
              type="text"
              value={jobTitleOverride}
              onChange={(e) => setJobTitleOverride(e.target.value)}
              disabled={generating}
              placeholder={jdAnalysis?.jobTitle || 'Auto-detected from JD if left blank'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Company Name (optional override for filename)
            </label>
            <input
              type="text"
              value={companyOverride}
              onChange={(e) => setCompanyOverride(e.target.value)}
              disabled={generating}
              placeholder={jdAnalysis?.companyName || 'Auto-detected from JD if left blank'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </div>
      </section>

      {/* Card 2: Dedicated Job Description Analysis Panel (Pre-Generation) */}
      <section
        aria-label="Job Description Analysis Panel"
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                2. Job Description Analysis Panel (Pre-Generation)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect extracted role context, essential vs. preferred requirements, skills,
                industry terminology, and profile gaps before generating your resume.
              </p>
            </div>
          </div>

          {jdAnalysis ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Analysis Ready</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={analyzingJd || generating || jobDescription.trim().length < 30}
              onClick={() => void handleAnalyzeJd()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50/70 rounded-lg hover:bg-blue-100/70 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>{analyzingJd ? 'Analyzing...' : 'Run JD Analysis'}</span>
            </button>
          )}
        </div>

        {analyzingJd ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-6 flex items-center gap-3 text-xs text-slate-700">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
            <span>
              Extracting job title, seniority, essential vs. preferred qualifications, technical
              skills, software tools, industry terminology, and Master Resume gaps...
            </span>
          </div>
        ) : !jdAnalysis ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="font-semibold text-slate-800">
                Job Description not analyzed yet
              </div>
              <p className="leading-relaxed">
                Paste a job description above (or upload a PDF/DOCX file) and click{' '}
                <span className="font-medium text-slate-900">Analyze Job Description</span> to
                preview extracted requirements, mandatory skills, ERP/software tools, key
                responsibilities, and ATS terminology before generation begins.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 whitespace-nowrap shrink-0 tabular-nums">
              {jobDescription.trim().length >= 30
                ? 'Ready to analyze'
                : 'Min. 30 characters required'}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Role Classification Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs border-b border-slate-100 pb-4">
              <div>
                <span className="text-slate-500 block">Job Title</span>
                <span className="font-semibold text-slate-900">{jdAnalysis.jobTitle}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Company</span>
                <span className="font-semibold text-slate-900">
                  {jdAnalysis.companyName || 'Target Company'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Department</span>
                <span className="font-semibold text-slate-900">
                  {jdAnalysis.department || 'General'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Industry</span>
                <span className="font-semibold text-slate-900">{jdAnalysis.industry}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Seniority</span>
                <span className="font-semibold text-slate-900">
                  {jdAnalysis.seniority || 'Mid-Level'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Experience Required</span>
                <span className="font-semibold text-slate-900">
                  {jdAnalysis.requiredExperience || 'Not specified'}
                </span>
              </div>
            </div>

            {/* Requirements & Profile Gaps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                <div className="font-semibold text-slate-900 tabular-nums">
                  Essential / Mandatory Requirements ({essentialList.length})
                </div>
                {essentialList.length === 0 ? (
                  <p className="text-slate-500">None explicitly listed.</p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                    {essentialList.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                <div className="font-semibold text-slate-900 tabular-nums">
                  Preferred Qualifications ({jdAnalysis.preferredSkills.length})
                </div>
                {jdAnalysis.preferredSkills.length === 0 ? (
                  <p className="text-slate-500">None explicitly separated.</p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                    {jdAnalysis.preferredSkills.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5 tabular-nums">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    Candidate Profile Gaps ({jdAnalysis.candidateGaps?.length ?? 0})
                  </span>
                </div>
                {!jdAnalysis.candidateGaps || jdAnalysis.candidateGaps.length === 0 ? (
                  <p className="text-emerald-700">
                    No major qualification gaps flagged against your Master Resume.
                  </p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                    {jdAnalysis.candidateGaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Key Responsibilities & Core Workflows */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs border-t border-slate-100 pt-4">
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-900 tabular-nums">
                  Extracted Key Responsibilities ({jdAnalysis.jobResponsibilities.length})
                </div>
                {jdAnalysis.jobResponsibilities.length === 0 ? (
                  <p className="text-slate-500">None extracted.</p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-slate-700 leading-relaxed">
                    {jdAnalysis.jobResponsibilities.slice(0, 8).map((resp, i) => (
                      <li key={i}>{resp}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="font-semibold text-slate-900 mb-0.5">
                    Educational Requirements
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {jdAnalysis.educationalRequirements?.join(', ') || 'None specified'}
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 mb-0.5">
                    Purchasing / Operational Processes
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {jdAnalysis.purchasingProcesses.join(', ') || 'General workflows'}
                  </p>
                </div>
                {jdAnalysis.procurementCategories.length > 0 && (
                  <div>
                    <div className="font-semibold text-slate-900 mb-0.5">
                      Domain / Procurement Categories
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      {jdAnalysis.procurementCategories.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Skills, Software & Terminology Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs border-t border-slate-100 pt-4">
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-slate-900">Technical Skills: </span>
                  <span className="text-slate-700">
                    {jdAnalysis.technicalSkills.join(', ') || 'None specified'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Software / ERP Systems: </span>
                  <span className="text-slate-700">
                    {jdAnalysis.softwareAndErp.join(', ') || 'None specified'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold text-slate-900">Industry Terminology: </span>
                  <span className="text-slate-700">
                    {jdAnalysis.industryTerminology?.join(', ') || 'General corporate terminology'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Recurring ATS Keywords: </span>
                  <span className="text-slate-700">
                    {jdAnalysis.importantAtsKeywords.join(', ') || 'None extracted'}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Template Recommendation based on Analyzed Role */}
            {templateRec && recommendedDef && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="space-y-1 max-w-3xl">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      AI Recommended Template: {recommendedDef.name} ({recommendedDef.atsLabel})
                    </span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{templateRec.reason}</p>
                  {templateRec.alternativeTemplateIds.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600">
                      <span>Alternatives:</span>
                      {templateRec.alternativeTemplateIds.map((altId) => {
                        const altDef = getTemplateDefinition(altId);
                        return (
                          <button
                            key={altId}
                            type="button"
                            onClick={() => handleSelectTemplate(altDef.id)}
                            className={`underline font-medium hover:text-blue-700 ${
                              templateId === altDef.id ? 'text-blue-700 font-semibold' : ''
                            }`}
                          >
                            {altDef.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectTemplate(recommendedDef.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                    templateId === recommendedDef.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {templateId === recommendedDef.id
                    ? 'Recommended Template Selected'
                    : 'Use Recommended Template'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Card 3: Strategy, 20-Template Browser & Generate */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="space-y-2.5">
          <label className="block text-sm font-semibold text-slate-900">
            3. Select AI Tailoring Strategy & Resume Template
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MODE_OPTIONS.map((opt) => {
              const selected = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={generating}
                  onClick={() => setMode(opt.id)}
                  className={`text-left rounded-lg border p-3.5 transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900">{opt.title}</div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-slate-900">
              Select Resume Design ({getTemplateDefinition(templateId).name} ·{' '}
              <span className="font-normal text-slate-600">
                {getTemplateDefinition(templateId).atsLabel}
              </span>
              )
            </div>
          </div>

          <TemplateSelector
            value={templateId}
            recommendedId={templateRec?.recommendedTemplateId}
            onChange={handleSelectTemplate}
            onOpenFullLibrary={onOpenTemplatesLibrary}
            disabled={generating}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || analyzingJd}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {generating ? 'Optimizing & Verifying Resume...' : 'Generate Job-Specific Resume'}
            </span>
          </button>
        </div>

        {generating && progress && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-800">
              <span>{progress.label}</span>
              <span className="tabular-nums font-mono">
                Step {progress.step} / {progress.total}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${Math.round((progress.step / progress.total) * 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Running baseline scoring, factual lock, 6-category ATS analysis, and automatic
                &lt;75% optimization if needed.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-4">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleGenerate}
              className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-300 rounded-md hover:bg-red-100 whitespace-nowrap shrink-0"
            >
              Retry
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
