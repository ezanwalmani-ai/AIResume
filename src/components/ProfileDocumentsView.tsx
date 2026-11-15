import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  apiDeleteDocument,
  apiDownloadDocument,
  apiGetProfile,
  apiListDocuments,
  apiUpdateProfile,
  apiUploadDocument,
  triggerBlobDownload,
} from '../lib/api.ts';
import type {
  CandidateDocumentRecord,
  CandidateProfileRecord,
} from '../types/database.ts';
import type { MasterResumeRecord } from '../types/resume.ts';

interface ProfileDocumentsViewProps {
  masterResume: MasterResumeRecord | null;
  onNavigateMaster: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ProfileDocumentsView({
  masterResume,
  onNavigateMaster,
}: ProfileDocumentsViewProps) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<CandidateProfileRecord | null>(null);
  const [documents, setDocuments] = useState<CandidateDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('supporting_document');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editable form state
  const [totalExperience, setTotalExperience] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [preferredLocationsText, setPreferredLocationsText] = useState('');
  const [preferredJobTitlesText, setPreferredJobTitlesText] = useState('');
  const [preferredSalary, setPreferredSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [joiningAvailability, setJoiningAvailability] = useState('');
  const [professionalSummary, setProfessionalSummary] = useState('');
  const [achievementsText, setAchievementsText] = useState('');

  const hydrateForm = useCallback((p: CandidateProfileRecord | null) => {
    setTotalExperience(p?.totalExperience ?? '');
    setCurrentLocation(p?.currentLocation ?? masterResume?.structuredData.personalInfo.location ?? '');
    setPreferredLocationsText((p?.preferredLocations ?? []).join(', '));
    setPreferredJobTitlesText((p?.preferredJobTitles ?? []).join(', '));
    setPreferredSalary(p?.preferredSalary ?? '');
    setNoticePeriod(p?.noticePeriod ?? '');
    setJoiningAvailability(p?.joiningAvailability ?? '');
    setProfessionalSummary(
      p?.professionalSummary ?? masterResume?.structuredData.professionalSummary ?? '',
    );
    setAchievementsText((p?.achievements ?? []).join('\n'));
  }, [masterResume]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [p, docs] = await Promise.all([
        apiGetProfile(token),
        apiListDocuments(token),
      ]);
      setProfile(p);
      setDocuments(docs);
      hydrateForm(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidate profile.');
    } finally {
      setLoading(false);
    }
  }, [getToken, hydrateForm]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      const updated = await apiUpdateProfile(token, {
        totalExperience: totalExperience.trim(),
        currentLocation: currentLocation.trim(),
        preferredLocations: preferredLocationsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredJobTitles: preferredJobTitlesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredSalary: preferredSalary.trim(),
        noticePeriod: noticePeriod.trim(),
        joiningAvailability: joiningAvailability.trim(),
        professionalSummary: professionalSummary.trim(),
        achievements: achievementsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setProfile(updated);
      setNotice('Candidate profile saved to PostgreSQL.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save candidate profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadDoc = async (file: File) => {
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      const doc = await apiUploadDocument(token, file, docType);
      setDocuments((prev) => [doc, ...prev]);
      setNotice(`Stored "${doc.documentName}" in private encrypted workspace storage.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDoc = async (doc: CandidateDocumentRecord) => {
    setError(null);
    try {
      const token = await getToken();
      const { blob, fileName } = await apiDownloadDocument(token, doc.id);
      triggerBlobDownload(blob, fileName || doc.documentName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download document.');
    }
  };

  const handleDeleteDoc = async (doc: CandidateDocumentRecord) => {
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      await apiDeleteDocument(token, doc.id);
      setDocuments((prev) => prev.filter((item) => item.id !== doc.id));
      setNotice(`Deleted "${doc.documentName}" from private storage.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document.');
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-4">
        <div className="h-8 w-72 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Candidate Profile & Document Vault
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage permanent career preferences, availability, and private supporting documents
            persisted in PostgreSQL.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateMaster}
          className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          Open Master Resume Editor
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Candidate Profile Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Permanent Candidate Preferences & Availability
            </h2>
          </div>
          {profile?.updatedAt && (
            <span className="text-xs text-slate-500 tabular-nums">
              Last synced {new Date(profile.updatedAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-600 mb-1">Total Experience</label>
            <input
              type="text"
              value={totalExperience}
              onChange={(e) => setTotalExperience(e.target.value)}
              placeholder="e.g., 7+ Years"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">Current Location</label>
            <input
              type="text"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              placeholder="e.g., Dubai, UAE"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">
              Preferred Compensation
            </label>
            <input
              type="text"
              value={preferredSalary}
              onChange={(e) => setPreferredSalary(e.target.value)}
              placeholder="e.g., AED 18,000 – 24,000 / month"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">Notice Period</label>
            <input
              type="text"
              value={noticePeriod}
              onChange={(e) => setNoticePeriod(e.target.value)}
              placeholder="e.g., Immediate / 30 Days"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">Joining Availability</label>
            <input
              type="text"
              value={joiningAvailability}
              onChange={(e) => setJoiningAvailability(e.target.value)}
              placeholder="e.g., Available immediately"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-600 mb-1">
              Preferred Locations (comma-separated)
            </label>
            <input
              type="text"
              value={preferredLocationsText}
              onChange={(e) => setPreferredLocationsText(e.target.value)}
              placeholder="Dubai, Abu Dhabi, Remote"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-600 mb-1">
              Preferred Job Titles (comma-separated)
            </label>
            <input
              type="text"
              value={preferredJobTitlesText}
              onChange={(e) => setPreferredJobTitlesText(e.target.value)}
              placeholder="Procurement Specialist, Senior Buyer, Supply Chain Coordinator"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-600 mb-1">
              Core Career Summary
            </label>
            <textarea
              rows={3}
              value={professionalSummary}
              onChange={(e) => setProfessionalSummary(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 leading-relaxed"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-600 mb-1">
              Key Career Achievements (one per line)
            </label>
            <textarea
              rows={4}
              value={achievementsText}
              onChange={(e) => setAchievementsText(e.target.value)}
              placeholder="Reduced direct vendor spend by 12%..."
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 leading-relaxed"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{saving ? 'Saving Profile...' : 'Save Candidate Profile'}</span>
          </button>
        </div>
      </section>

      {/* Private Documents Vault */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Private Uploaded Documents ({documents.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Original uploaded resumes, certifications, and supporting files stored in private
              user-isolated storage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              aria-label="Document type"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
            >
              <option value="supporting_document">Supporting Document</option>
              <option value="certification">Certification</option>
              <option value="cover_letter">Cover Letter</option>
              <option value="portfolio">Portfolio</option>
            </select>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUploadDoc(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileUp className="w-3.5 h-3.5" />
              )}
              <span>{uploading ? 'Uploading...' : 'Upload Private Document'}</span>
            </button>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <FileText className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-900">No private documents stored yet</p>
            <p className="text-xs text-slate-500">
              Upload your Master Resume or add supporting PDF, DOCX, or TXT files above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                  <th className="py-2.5 px-6">Document Name</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Format</th>
                  <th className="py-2.5 px-4 text-right">Size</th>
                  <th className="py-2.5 px-4">Uploaded</th>
                  <th className="py-2.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-6 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{doc.documentName}</span>
                        {doc.isMasterResume && (
                          <span className="text-[11px] font-semibold text-blue-700">
                            (Master)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-600">
                      {doc.documentType.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 uppercase font-mono text-slate-600">
                      {doc.fileFormat}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatBytes(doc.fileSize)}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-500">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleDownloadDoc(doc)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteDoc(doc)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
