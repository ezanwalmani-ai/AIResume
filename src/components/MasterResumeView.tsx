import { useState, type ChangeEvent, type DragEvent } from 'react';
import {
  CheckCircle2,
  Columns2,
  FileText,
  Lock,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  apiExtractMasterResumeFile,
  apiExtractMasterResumeText,
  apiSaveMasterResume,
} from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DEFAULT_SECTION_ORDER,
  type CertificationRecord,
  type EducationRecord,
  type EmploymentRecord,
  type MasterResumeData,
  type MasterResumeRecord,
  type TailoredResumeContent,
} from '../types/resume.ts';
import { LiveResumeSheet } from './LiveResumeSheet.tsx';

interface MasterResumeViewProps {
  masterResume: MasterResumeRecord | null;
  onUpdated: (record: MasterResumeRecord) => void;
  onNavigateGenerate: () => void;
}

const EMPTY_MASTER_DATA: MasterResumeData = {
  personalInfo: {
    fullName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    portfolio: '',
  },
  headline: '',
  professionalSummary: '',
  employmentHistory: [],
  procurementExperience: [],
  technicalSkills: [],
  erpKnowledge: [],
  education: [],
  certifications: [],
  languages: [],
  additionalQualifications: [],
};

function parseListInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseLinesInput(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function masterToPreviewContent(data: MasterResumeData): TailoredResumeContent {
  return {
    personalInfo: data.personalInfo,
    professionalTitle: data.headline,
    professionalSummary: data.professionalSummary,
    coreCompetencies: data.procurementExperience,
    professionalExperience: data.employmentHistory.map((job) => ({
      id: job.id,
      companyName: job.companyName,
      jobTitle: job.jobTitle,
      location: job.location,
      startDate: job.startDate,
      endDate: job.isCurrent ? 'Present' : job.endDate,
      isCurrent: job.isCurrent,
      bullets: [...job.responsibilities, ...job.achievements],
    })),
    technicalSkills: data.technicalSkills,
    erpAndSoftwareKnowledge: data.erpKnowledge,
    educationalQualifications: data.education,
    certifications: data.certifications,
    languages: data.languages,
    sectionOrder: [...DEFAULT_SECTION_ORDER],
  };
}

export function MasterResumeView({
  masterResume,
  onUpdated,
  onNavigateGenerate,
}: MasterResumeViewProps) {
  const { getToken } = useAuth();
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(true);

  const [draft, setDraft] = useState<MasterResumeData>(
    masterResume?.structuredData ?? EMPTY_MASTER_DATA,
  );
  const [showEditor, setShowEditor] = useState<boolean>(Boolean(masterResume));

  const syncFromRecord = (record: MasterResumeRecord) => {
    setDraft(record.structuredData);
    setShowEditor(true);
    onUpdated(record);
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    setNotice(null);
    setExtracting(true);
    try {
      const token = await getToken();
      const res = await apiExtractMasterResumeFile(token, file);
      syncFromRecord(res.masterResume);
      setNotice(
        `Extracted structured profile from "${file.name}" using ${res.modelUsed}. Review all fields below and click Approve & Save.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract resume file.');
    } finally {
      setExtracting(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
  };

  const handleExtractText = async () => {
    if (!rawText.trim()) {
      setError('Please paste your resume text before extracting.');
      return;
    }
    setError(null);
    setNotice(null);
    setExtracting(true);
    try {
      const token = await getToken();
      const res = await apiExtractMasterResumeText(token, rawText);
      syncFromRecord(res.masterResume);
      setNotice(
        `Extracted structured profile using ${res.modelUsed}. Review and verify all fields below, then approve and save.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract resume text.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async (approve: boolean) => {
    if (!draft.personalInfo.fullName.trim()) {
      setError('Full name is required before saving your Master Resume.');
      return;
    }
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const nameParts = draft.personalInfo.fullName.trim().split(/\s+/);
      const normalized: MasterResumeData = {
        ...draft,
        personalInfo: {
          ...draft.personalInfo,
          firstName: draft.personalInfo.firstName.trim() || nameParts[0] || '',
          lastName:
            draft.personalInfo.lastName.trim() || nameParts.slice(1).join(' ') || '',
        },
      };
      const token = await getToken();
      const saved = await apiSaveMasterResume(token, normalized, approve);
      syncFromRecord(saved);
      setNotice(
        approve
          ? 'Master Resume approved and locked in database. Tailored resume generations will never overwrite this profile.'
          : 'Master Resume draft saved.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Master Resume.');
    } finally {
      setSaving(false);
    }
  };

  const updateEmployment = (idx: number, patch: Partial<EmploymentRecord>) => {
    setDraft((prev) => {
      const next = [...prev.employmentHistory];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, employmentHistory: next };
    });
  };

  const addEmployment = () => {
    setDraft((prev) => ({
      ...prev,
      employmentHistory: [
        ...prev.employmentHistory,
        {
          id: `exp_${Date.now()}`,
          companyName: '',
          jobTitle: '',
          location: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          responsibilities: [],
          achievements: [],
          procurementCategories: [],
          toolsAndErp: [],
        },
      ],
    }));
  };

  const removeEmployment = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      employmentHistory: prev.employmentHistory.filter((_, i) => i !== idx),
    }));
  };

  const updateEducation = (idx: number, patch: Partial<EducationRecord>) => {
    setDraft((prev) => {
      const next = [...prev.education];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, education: next };
    });
  };

  const addEducation = () => {
    setDraft((prev) => ({
      ...prev,
      education: [
        ...prev.education,
        {
          id: `edu_${Date.now()}`,
          institution: '',
          degree: '',
          fieldOfStudy: '',
          graduationDate: '',
          location: '',
          details: '',
        },
      ],
    }));
  };

  const removeEducation = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== idx),
    }));
  };

  const updateCertification = (idx: number, patch: Partial<CertificationRecord>) => {
    setDraft((prev) => {
      const next = [...prev.certifications];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, certifications: next };
    });
  };

  const addCertification = () => {
    setDraft((prev) => ({
      ...prev,
      certifications: [
        ...prev.certifications,
        { id: `cert_${Date.now()}`, name: '', issuer: '', date: '' },
      ],
    }));
  };

  const removeCertification = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className={`${showEditor && showLivePreview ? 'max-w-[1380px]' : 'max-w-5xl'} space-y-8`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Master Resume Vault
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Upload your original resume once in PDF or DOCX format. Google Gemini extracts your
            career history into a permanent, verified source of truth that is never altered when
            generating tailored versions.
          </p>
        </div>
        {masterResume && (
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-slate-600 tabular-nums">
              <div className="font-medium text-slate-900">
                {masterResume.isApproved ? 'Approved & Locked' : 'Pending Review'} · v
                {masterResume.version}
              </div>
              <div>
                Updated {new Date(masterResume.updatedAt).toLocaleDateString()}
              </div>
            </div>
            {masterResume.isApproved && (
              <button
                type="button"
                onClick={onNavigateGenerate}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
              >
                Tailor for a Job
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload / Extract Section */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              01. Import Original Resume
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Supports PDF, DOCX, or pasted text. {masterResume?.originalFileName ? `Last imported: ${masterResume.originalFileName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                inputMode === 'file'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upload PDF / DOCX
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                inputMode === 'text'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paste Text
            </button>
            {!showEditor && (
              <button
                type="button"
                onClick={() => setShowEditor(true)}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                Manual Entry
              </button>
            )}
          </div>
        </div>

        {inputMode === 'file' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-lg border border-dashed p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
            }`}
          >
            <Upload className="w-7 h-7 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900">
              {extracting
                ? 'Extracting structured career profile with Gemini AI...'
                : 'Drop your PDF or DOCX resume here, or select a file'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              PDF, DOCX, or TXT up to 10 MB
            </p>
            <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors">
              <FileText className="w-3.5 h-3.5" />
              <span>{extracting ? 'Processing...' : 'Choose Resume File'}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={handleFileChange}
                disabled={extracting}
                className="hidden"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              placeholder="Paste your complete original resume text here..."
              className="w-full rounded-lg border border-slate-200 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleExtractText}
                disabled={extracting}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {extracting ? 'Extracting with Gemini...' : 'Extract Structured Profile'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
        )}
      </section>

      {/* Review & Correction Editor + Real-Time Live Preview */}
      {showEditor && (
        <div
          className={`grid gap-6 items-start ${
            showLivePreview ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'
          }`}
        >
        <section
          className={`rounded-xl border border-slate-200 bg-white p-6 space-y-8 ${
            showLivePreview ? 'xl:col-span-7' : ''
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                02. Review & Approve Permanent Master Resume
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Names, contact info, companies, titles, dates, education, and certifications
                  stored here serve as immutable factual anchors.
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowLivePreview((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  showLivePreview
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>{showLivePreview ? 'Live Preview On' : 'Show Live Preview'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {saving ? 'Saving...' : 'Approve & Save Master Resume'}
              </button>
            </div>
          </div>

          {/* Personal & Contact Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Personal & Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={draft.personalInfo.fullName}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personalInfo: { ...draft.personalInfo, fullName: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  First Name (PDF filename)
                </label>
                <input
                  type="text"
                  value={draft.personalInfo.firstName}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personalInfo: { ...draft.personalInfo, firstName: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Last Name (PDF filename)
                </label>
                <input
                  type="text"
                  value={draft.personalInfo.lastName}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personalInfo: { ...draft.personalInfo, lastName: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={draft.personalInfo.email}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personalInfo: { ...draft.personalInfo, email: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={draft.personalInfo.phone}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personalInfo: { ...draft.personalInfo, phone: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={draft.personalInfo.location}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personalInfo: { ...draft.personalInfo, location: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  LinkedIn URL
                </label>
                <input
                  type="text"
                  value={draft.personalInfo.linkedin}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personalInfo: { ...draft.personalInfo, linkedin: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Portfolio / Website
                </label>
                <input
                  type="text"
                  value={draft.personalInfo.portfolio}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      personalInfo: { ...draft.personalInfo, portfolio: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Current Headline / Title
                </label>
                <input
                  type="text"
                  value={draft.headline}
                  onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Professional Summary */}
          <div className="space-y-2 border-t border-slate-100 pt-6">
            <label className="block text-sm font-semibold text-slate-900">
              Professional Summary
            </label>
            <textarea
              rows={4}
              value={draft.professionalSummary}
              onChange={(e) => setDraft({ ...draft, professionalSummary: e.target.value })}
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Employment History */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Employment History ({draft.employmentHistory.length})
              </h3>
              <button
                type="button"
                onClick={addEmployment}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Role</span>
              </button>
            </div>

            <div className="space-y-6">
              {draft.employmentHistory.map((job, idx) => (
                <div
                  key={job.id || idx}
                  className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      Role #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEmployment(idx)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={job.companyName}
                        onChange={(e) => updateEmployment(idx, { companyName: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={job.jobTitle}
                        onChange={(e) => updateEmployment(idx, { jobTitle: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Location
                      </label>
                      <input
                        type="text"
                        value={job.location}
                        onChange={(e) => updateEmployment(idx, { location: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Joining Date
                      </label>
                      <input
                        type="text"
                        value={job.startDate}
                        onChange={(e) => updateEmployment(idx, { startDate: e.target.value })}
                        placeholder="e.g., Jan 2021"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Leaving Date
                      </label>
                      <input
                        type="text"
                        value={job.isCurrent ? 'Present' : job.endDate}
                        disabled={job.isCurrent}
                        onChange={(e) => updateEmployment(idx, { endDate: e.target.value })}
                        placeholder="e.g., Mar 2024"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm disabled:bg-slate-100"
                      />
                    </div>
                    <div className="flex items-end pb-1.5">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={job.isCurrent}
                          onChange={(e) =>
                            updateEmployment(idx, {
                              isCurrent: e.target.checked,
                              endDate: e.target.checked ? 'Present' : job.endDate,
                            })
                          }
                          className="rounded border-slate-300"
                        />
                        <span>Currently employed here</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Responsibilities (one per line)
                      </label>
                      <textarea
                        rows={5}
                        value={job.responsibilities.join('\n')}
                        onChange={(e) =>
                          updateEmployment(idx, {
                            responsibilities: parseLinesInput(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Verified Achievements (one per line)
                      </label>
                      <textarea
                        rows={5}
                        value={job.achievements.join('\n')}
                        onChange={(e) =>
                          updateEmployment(idx, {
                            achievements: parseLinesInput(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Procurement / Domain Categories (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={job.procurementCategories.join(', ')}
                        onChange={(e) =>
                          updateEmployment(idx, {
                            procurementCategories: parseListInput(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Tools & ERP Used in Role (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={job.toolsAndErp.join(', ')}
                        onChange={(e) =>
                          updateEmployment(idx, {
                            toolsAndErp: parseListInput(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skills, Procurement Experience & ERP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Technical Skills (comma or newline separated)
              </label>
              <textarea
                rows={4}
                value={draft.technicalSkills.join(', ')}
                onChange={(e) =>
                  setDraft({ ...draft, technicalSkills: parseListInput(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                ERP & Software Knowledge (comma or newline separated)
              </label>
              <textarea
                rows={4}
                value={draft.erpKnowledge.join(', ')}
                onChange={(e) =>
                  setDraft({ ...draft, erpKnowledge: parseListInput(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Procurement & Operations Experience (one per line)
              </label>
              <textarea
                rows={4}
                value={draft.procurementExperience.join('\n')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    procurementExperience: parseLinesInput(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Additional Qualifications (one per line)
              </label>
              <textarea
                rows={4}
                value={draft.additionalQualifications.join('\n')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    additionalQualifications: parseLinesInput(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Education */}
          <div className="space-y-3 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Education ({draft.education.length})
              </h3>
              <button
                type="button"
                onClick={addEducation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Education</span>
              </button>
            </div>
            {draft.education.map((edu, idx) => (
              <div
                key={edu.id || idx}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-lg border border-slate-200 p-3 items-end"
              >
                <input
                  type="text"
                  value={edu.institution}
                  onChange={(e) => updateEducation(idx, { institution: e.target.value })}
                  placeholder="Institution"
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => updateEducation(idx, { degree: e.target.value })}
                  placeholder="Degree"
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={edu.fieldOfStudy}
                  onChange={(e) => updateEducation(idx, { fieldOfStudy: e.target.value })}
                  placeholder="Field of Study"
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  value={edu.graduationDate}
                  onChange={(e) => updateEducation(idx, { graduationDate: e.target.value })}
                  placeholder="Year / Date"
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeEducation(idx)}
                    className="text-xs text-red-600 hover:text-red-700 px-2 py-1.5"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Certifications & Languages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Certifications ({draft.certifications.length})
                </h3>
                <button
                  type="button"
                  onClick={addCertification}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
              {draft.certifications.map((cert, idx) => (
                <div key={cert.id || idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cert.name}
                    onChange={(e) => updateCertification(idx, { name: e.target.value })}
                    placeholder="Certification name"
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={cert.issuer}
                    onChange={(e) => updateCertification(idx, { issuer: e.target.value })}
                    placeholder="Issuer"
                    className="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeCertification(idx)}
                    className="text-xs text-red-600 px-1.5"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900">
                Languages (format: Language - Proficiency, one per line)
              </label>
              <textarea
                rows={4}
                value={draft.languages
                  .map((l) => (l.proficiency ? `${l.language} - ${l.proficiency}` : l.language))
                  .join('\n')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    languages: parseLinesInput(e.target.value).map((line) => {
                      const [language, proficiency] = line.split('-').map((s) => s.trim());
                      return { language: language || '', proficiency: proficiency || '' };
                    }),
                  })
                }
                placeholder="English - Fluent"
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {saving ? 'Saving...' : 'Approve & Save Master Resume'}
            </button>
          </div>
        </section>

        {showLivePreview && (
          <div className="xl:col-span-5 xl:sticky xl:top-4 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-700">
                Real-Time Master Resume Preview
              </span>
              <span className="text-[11px] text-slate-500">
                Updates as you edit
              </span>
            </div>
            <LiveResumeSheet
              content={masterToPreviewContent(draft)}
              templateId="classic_ats"
              compact
            />
          </div>
        )}
        </div>
      )}
    </div>
  );
}
