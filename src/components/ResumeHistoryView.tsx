import { useState } from 'react';
import { Download, ExternalLink, Search, Trash2 } from 'lucide-react';
import { apiDeleteResume, apiDownloadExport, triggerBlobDownload } from '../lib/api.ts';
import { getTemplateDefinition } from '../lib/templates.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { GeneratedResumeRecord } from '../types/resume.ts';

interface ResumeHistoryViewProps {
  resumes: GeneratedResumeRecord[];
  onSelectResume: (record: GeneratedResumeRecord) => void;
  onSelectAts: (record: GeneratedResumeRecord) => void;
  onDeleted: (id: number) => void;
  onNavigateGenerate: () => void;
}

export function ResumeHistoryView({
  resumes,
  onSelectResume,
  onSelectAts,
  onDeleted,
  onNavigateGenerate,
}: ResumeHistoryViewProps) {
  const { getToken } = useAuth();
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'balanced' | 'maximum_alignment' | 'conservative'>('all');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = resumes.filter((item) => {
    const matchesMode = modeFilter === 'all' || item.generationMode === modeFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.jobTitle.toLowerCase().includes(q) ||
      item.companyName.toLowerCase().includes(q) ||
      getTemplateDefinition(item.templateId).name.toLowerCase().includes(q);
    return matchesMode && matchesQuery;
  });

  const handleDownload = async (record: GeneratedResumeRecord, format: 'pdf' | 'docx') => {
    setError(null);
    setBusyId(record.id);
    try {
      const token = await getToken();
      const { blob, filename } = await apiDownloadExport(token, format, {
        tailoredResume: record.tailoredResume,
        templateId: record.templateId,
        templateCustomization: record.templateCustomization,
        jobTitle: record.jobTitle,
        companyName: record.companyName,
      });
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    setBusyId(id);
    try {
      const token = await getToken();
      await apiDeleteResume(token, id);
      onDeleted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete resume version.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Resume History</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every tailored resume version is stored independently without modifying your Master
            Resume. Save separate versions with different templates to compare layouts.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateGenerate}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap shrink-0"
        >
          New Tailored Resume
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job title, company, or template..."
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'all', label: 'All Modes' },
              { id: 'balanced', label: 'Balanced' },
              { id: 'maximum_alignment', label: 'Max Alignment' },
              { id: 'conservative', label: 'Conservative' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setModeFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                modeFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900">
            {resumes.length === 0
              ? 'No tailored resumes generated yet'
              : 'No matching resume versions'}
          </p>
          <p className="text-xs text-slate-500">
            {resumes.length === 0
              ? 'Paste any job description to generate your first tailored, ATS-ready PDF.'
              : 'Try clearing your search or mode filter.'}
          </p>
          {resumes.length === 0 && (
            <button
              type="button"
              onClick={onNavigateGenerate}
              className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Generate First Resume
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                <th className="py-2.5 px-4">Ver</th>
                <th className="py-2.5 px-4">Target Role</th>
                <th className="py-2.5 px-4">Company</th>
                <th className="py-2.5 px-4">Template</th>
                <th className="py-2.5 px-4">Mode</th>
                <th className="py-2.5 px-4 text-right">ATS Score</th>
                <th className="py-2.5 px-4">Created</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                    v{item.version}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    <button
                      type="button"
                      onClick={() => onSelectResume(item)}
                      className="hover:text-blue-600 text-left"
                    >
                      {item.jobTitle}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{item.companyName}</td>
                  <td className="py-3 px-4 text-slate-700">
                    {getTemplateDefinition(item.templateId).name}
                  </td>
                  <td className="py-3 px-4 text-slate-600 capitalize">
                    {item.generationMode.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                    {typeof item.atsAnalysis.originalAtsScore === 'number'
                      ? `${item.atsAnalysis.originalAtsScore}% → ${item.atsAnalysis.estimatedAlignmentScore}%`
                      : `${item.atsAnalysis.estimatedAlignmentScore}%`}
                  </td>
                  <td className="py-3 px-4 tabular-nums text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectResume(item)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectAts(item)}
                        className="text-slate-600 hover:text-slate-900 font-medium"
                      >
                        ATS
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleDownload(item, 'pdf')}
                        className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 font-medium"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleDownload(item, 'docx')}
                        className="text-slate-700 hover:text-slate-900 font-medium"
                      >
                        DOCX
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Delete version"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
