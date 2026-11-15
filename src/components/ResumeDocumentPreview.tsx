import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Briefcase,
  CheckCircle2,
  Columns2,
  CopyPlus,
  Download,
  Eye,
  GitCompare,
  HelpCircle,
  LayoutTemplate,
  Lock,
  PenLine,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import {
  apiCreateApplication,
  apiDownloadExport,
  apiDuplicateResumeWithTemplate,
  apiGenerateTailoredResume,
  apiOptimizeResume,
  apiUpdateResume,
  apiVerifyResume,
  triggerBlobDownload,
  type GenerationProgressEvent,
} from '../lib/api.ts';
import {
  ATS_CLASSIFICATION_LABELS,
  RESUME_TEMPLATES,
  TEMPLATE_CATEGORY_META,
  getEffectiveSectionOrder,
  getTemplateDefinition,
  normalizeTemplateId,
  resolveTemplateCustomization,
} from '../lib/templates.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DEFAULT_SECTION_ORDER,
  type AtsClassification,
  type GeneratedResumeRecord,
  type GenerationMode,
  type MasterResumeData,
  type OptimizationAction,
  type ResumeSectionKey,
  type ResumeTemplateId,
  type TailoredResumeContent,
  type TemplateCustomization,
} from '../types/resume.ts';
import { LiveResumeSheet } from './LiveResumeSheet.tsx';
import { OriginalVsOptimizedDiff } from './OriginalVsOptimizedDiff.tsx';
import { TemplateCustomizer } from './TemplateCustomizer.tsx';

interface ResumeDocumentPreviewProps {
  record: GeneratedResumeRecord;
  masterData?: MasterResumeData;
  onUpdated: (record: GeneratedResumeRecord) => void;
  onRegenerated?: (record: GeneratedResumeRecord) => void;
  onSavedAsNewVersion?: (record: GeneratedResumeRecord) => void;
  onViewAtsAnalysis?: () => void;
  onOpenTemplatesLibrary?: () => void;
  onTrackApplication?: (applicationId: string) => void;
}

const SECTION_LABELS: Record<ResumeSectionKey, string> = {
  summary: 'Professional Summary',
  competencies: 'Core Competencies',
  experience: 'Professional Experience',
  technical_skills: 'Technical Skills',
  erp_knowledge: 'ERP & Software Knowledge',
  education: 'Educational Qualifications',
  certifications: 'Certifications',
  languages: 'Languages',
};

export function ResumeDocumentPreview({
  record,
  masterData,
  onUpdated,
  onRegenerated,
  onSavedAsNewVersion,
  onViewAtsAnalysis,
  onOpenTemplatesLibrary,
  onTrackApplication,
}: ResumeDocumentPreviewProps) {
  const { getToken } = useAuth();
  const [content, setContent] = useState<TailoredResumeContent>(record.tailoredResume);
  const [templateId, setTemplateId] = useState<ResumeTemplateId>(() =>
    normalizeTemplateId(record.templateId),
  );
  const [customization, setCustomization] = useState<TemplateCustomization>(() =>
    resolveTemplateCustomization(record.templateId, record.templateCustomization),
  );
  const [regenMode, setRegenMode] = useState<GenerationMode>(record.generationMode);
  const [layoutView, setLayoutView] = useState<'split' | 'editor' | 'preview' | 'compare'>('split');

  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showMissingKeywords, setShowMissingKeywords] = useState(false);
  const [optimizingAction, setOptimizingAction] = useState<OptimizationAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [trackingApp, setTrackingApp] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState<GenerationProgressEvent | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Sync local editor & real-time preview immediately when an updated/regenerated record arrives
  useEffect(() => {
    const normalizedId = normalizeTemplateId(record.templateId);
    setContent(record.tailoredResume);
    setTemplateId(normalizedId);
    setCustomization(resolveTemplateCustomization(normalizedId, record.templateCustomization));
    setRegenMode(record.generationMode);
    setDirty(false);
  }, [record]);

  const sectionOrder: ResumeSectionKey[] =
    content.sectionOrder && content.sectionOrder.length > 0
      ? content.sectionOrder
      : [...DEFAULT_SECTION_ORDER];

  const handleSelectTemplate = (nextRawId: string) => {
    const nextId = normalizeTemplateId(nextRawId);
    setTemplateId(nextId);
    setCustomization(resolveTemplateCustomization(nextId));
    setContent((prev) => ({
      ...prev,
      sectionOrder: getEffectiveSectionOrder(prev.sectionOrder, nextId, true),
    }));
    setDirty(true);
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sectionOrder.length) return;
    const next = [...sectionOrder];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setContent({ ...content, sectionOrder: next });
    setDirty(true);
  };

  const handleSave = async () => {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const token = await getToken();
      const updated = await apiUpdateResume(token, record.id, {
        tailoredResume: content,
        templateId,
        templateCustomization: customization,
      });
      onUpdated(updated);
      setDirty(false);
      setNotice('Saved changes and re-verified factual consistency.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save resume changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNewVersionWithTemplate = async () => {
    setError(null);
    setNotice(null);
    setDuplicating(true);
    try {
      const token = await getToken();
      const created = await apiDuplicateResumeWithTemplate(token, record.id, {
        templateId,
        templateCustomization: customization,
        tailoredResume: content,
      });
      setDirty(false);
      setNotice(
        `Saved separate version v${created.version} (${created.jobTitle} – ${getTemplateDefinition(templateId).name}).`,
      );
      if (onSavedAsNewVersion) {
        onSavedAsNewVersion(created);
      } else {
        onUpdated(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save separate resume version.');
    } finally {
      setDuplicating(false);
    }
  };

  const handleTargetedOptimize = async (action: OptimizationAction) => {
    setError(null);
    setNotice(null);
    setOptimizingAction(action);
    try {
      const token = await getToken();
      const result = await apiOptimizeResume(token, record.id, action, content);
      setContent(result.resume.tailoredResume);
      setDirty(false);
      onUpdated(result.resume);
      const actionLabel =
        action === 'improve_ats'
          ? 'ATS optimization pass'
          : action === 'rewrite_summary'
            ? 'Professional Summary rewrite'
            : action === 'optimize_experience'
              ? 'Work Experience optimization'
              : 'Skills & Keywords optimization';
      setNotice(
        `Completed ${actionLabel}. Updated ATS Score: ${result.resume.atsAnalysis.estimatedAlignmentScore}%.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization failed. Please retry.');
    } finally {
      setOptimizingAction(null);
    }
  };

  const handleRegenerate = async () => {
    setError(null);
    setNotice(null);
    setRegenerating(true);
    setRegenProgress({
      step: 1,
      total: 8,
      label: 'Regenerating tailored resume with proactive ATS optimizer...',
    });

    try {
      const token = await getToken();
      const newRecord = await apiGenerateTailoredResume(
        token,
        {
          jobDescription: record.originalJd,
          mode: regenMode,
          templateId,
          templateCustomization: customization,
          jobTitleOverride: record.jobTitle,
          companyOverride: record.companyName,
          precomputedJdAnalysis: record.jdAnalysis,
        },
        (evt) => setRegenProgress(evt),
      );
      setContent(newRecord.tailoredResume);
      setTemplateId(normalizeTemplateId(newRecord.templateId));
      setCustomization(
        resolveTemplateCustomization(newRecord.templateId, newRecord.templateCustomization),
      );
      setDirty(false);
      setNotice(`Generated v${newRecord.version} using ${regenMode.replace('_', ' ')} mode.`);
      if (onRegenerated) {
        onRegenerated(newRecord);
      } else {
        onUpdated(newRecord);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed. Please retry.');
    } finally {
      setRegenerating(false);
      setRegenProgress(null);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    setError(null);
    setNotice(null);
    setDownloading(format);
    try {
      const token = await getToken();
      const verification = await apiVerifyResume(token, record.id, content);
      if (!verification.passed) {
        const msg = verification.violations.map((v) => v.message).join(' ');
        setError(`Factual consistency check blocked export: ${msg}`);
        setDownloading(null);
        return;
      }

      const { blob, filename, validation } = await apiDownloadExport(token, format, {
        tailoredResume: content,
        templateId,
        templateCustomization: customization,
        jobTitle: record.jobTitle,
        companyName: record.companyName,
      });
      triggerBlobDownload(blob, filename);
      const valSuffix = validation?.valid
        ? ' Selectable text & reading order verified.'
        : validation?.warnings?.length
          ? ` ${validation.warnings.join(' ')}`
          : '';
      setNotice(`Downloaded ${filename}.${valSuffix}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}.`);
    } finally {
      setDownloading(null);
    }
  };

  const handleTrackApplication = async () => {
    setError(null);
    setNotice(null);
    setTrackingApp(true);
    try {
      const token = await getToken();
      const created = await apiCreateApplication(token, {
        generatedResumeId: record.id,
        companyName: record.companyName || 'Target Company',
        jobTitle: record.jobTitle || content.professionalTitle || 'Target Role',
        applicationStatus: 'Resume Generated',
        applicationMethod: 'portal',
        notes: `Linked tailored resume v${record.version} (ATS ${record.atsAnalysis.estimatedAlignmentScore}%)`,
      });
      setNotice(
        `Added "${created.jobTitle}" at ${created.companyName} to Application Tracker.`,
      );
      if (onTrackApplication) {
        onTrackApplication(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track application.');
    } finally {
      setTrackingApp(false);
    }
  };

  const updateExperienceBullet = (expIdx: number, bulletIdx: number, value: string) => {
    const next = [...content.professionalExperience];
    const bullets = [...next[expIdx].bullets];
    bullets[bulletIdx] = value;
    next[expIdx] = { ...next[expIdx], bullets };
    setContent({ ...content, professionalExperience: next });
    setDirty(true);
  };

  const moveExperienceBullet = (expIdx: number, bulletIdx: number, direction: -1 | 1) => {
    const bullets = [...content.professionalExperience[expIdx].bullets];
    const target = bulletIdx + direction;
    if (target < 0 || target >= bullets.length) return;
    const [item] = bullets.splice(bulletIdx, 1);
    bullets.splice(target, 0, item);
    const next = [...content.professionalExperience];
    next[expIdx] = { ...next[expIdx], bullets };
    setContent({ ...content, professionalExperience: next });
    setDirty(true);
  };

  const addExperienceBullet = (expIdx: number) => {
    const next = [...content.professionalExperience];
    next[expIdx] = { ...next[expIdx], bullets: [...next[expIdx].bullets, ''] };
    setContent({ ...content, professionalExperience: next });
    setDirty(true);
  };

  const removeExperienceBullet = (expIdx: number, bulletIdx: number) => {
    const next = [...content.professionalExperience];
    next[expIdx] = {
      ...next[expIdx],
      bullets: next[expIdx].bullets.filter((_, i) => i !== bulletIdx),
    };
    setContent({ ...content, professionalExperience: next });
    setDirty(true);
  };

  const { atsAnalysis } = record;
  const originalScore = atsAnalysis.originalAtsScore;
  const finalScore = atsAnalysis.estimatedAlignmentScore;
  const isBusy = regenerating || optimizingAction !== null || duplicating;
  const templateDef = getTemplateDefinition(templateId);
  const effectiveAts: AtsClassification =
    templateDef.atsClassification === 'ats_friendly' && customization.layout !== 'single_column'
      ? 'ats_caution'
      : templateDef.atsClassification;
  const effectiveAtsLabel =
    templateDef.atsClassification === 'ats_friendly' && customization.layout !== 'single_column'
      ? 'ATS-Compatible with Caution (two-column layout active)'
      : ATS_CLASSIFICATION_LABELS[templateDef.atsClassification];

  return (
    <div className="space-y-4">
      {/* Studio Primary Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setLayoutView('split')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                layoutView === 'split'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Live Split</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutView('editor')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                layoutView === 'editor'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutView('preview')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                layoutView === 'preview'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutView('compare')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                layoutView === 'compare'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare Original</span>
            </button>
          </div>

          {/* 20-Template Selector + Library + Customizer */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={normalizeTemplateId(templateId)}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              disabled={isBusy}
              aria-label="Resume template"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 max-w-[220px]"
            >
              {TEMPLATE_CATEGORY_META.map((cat) => (
                <optgroup key={cat.id} label={cat.label}>
                  {RESUME_TEMPLATES.filter((t) => t.category === cat.id).map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {onOpenTemplatesLibrary && (
              <button
                type="button"
                onClick={onOpenTemplatesLibrary}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-blue-600" />
                <span>Browse Templates (20)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowCustomizer((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                showCustomizer
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showCustomizer ? 'Hide Customizer' : 'Customize Design'}</span>
            </button>
          </div>

          {onViewAtsAnalysis && (
            <button
              type="button"
              onClick={onViewAtsAnalysis}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              {typeof originalScore === 'number' && (
                <>
                  <span className="text-slate-500">Original {originalScore}%</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </>
              )}
              <span
                className={`font-semibold ${
                  finalScore >= 75 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                ATS: {finalScore}%
              </span>
            </button>
          )}
        </div>

        {/* Save, Regenerate & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <select
              value={regenMode}
              onChange={(e) => setRegenMode(e.target.value as GenerationMode)}
              disabled={isBusy}
              aria-label="Regeneration mode"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700"
            >
              <option value="balanced">Balanced</option>
              <option value="maximum_alignment">Max Alignment</option>
              <option value="conservative">Conservative</option>
            </select>
            <button
              type="button"
              onClick={() => void handleRegenerate()}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              <span>{regenerating ? 'Regenerating...' : 'Regenerate'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleTrackApplication()}
            disabled={isBusy || trackingApp}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
          >
            <Briefcase className="w-3.5 h-3.5 text-blue-600" />
            <span>{trackingApp ? 'Tracking...' : 'Track Application'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSaveNewVersionWithTemplate()}
            disabled={isBusy || saving}
            title="Save a separate version with this template without overwriting the current version"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
          >
            <CopyPlus className="w-3.5 h-3.5" />
            <span>{duplicating ? 'Saving Copy...' : 'Save as New Version'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('docx')}
            disabled={downloading !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading === 'docx' ? 'Exporting...' : 'DOCX'}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={downloading !== null}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading === 'pdf' ? 'Generating...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* ATS Classification Caution Note when non-strict layout is selected */}
      {effectiveAts !== 'ats_friendly' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{templateDef.name}</strong> — {effectiveAtsLabel}. For strict automated ATS
              job portals, consider a single-column ATS-Friendly template such as{' '}
              <strong>Classic Professional</strong> or <strong>Modern ATS</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleSelectTemplate('modern_ats')}
            className="text-xs font-semibold text-amber-900 underline hover:text-amber-700 whitespace-nowrap shrink-0"
          >
            Switch to Modern ATS
          </button>
        </div>
      )}

      {/* Collapsible Template Design Customizer */}
      {showCustomizer && (
        <TemplateCustomizer
          templateId={templateId}
          customization={customization}
          sectionOrder={sectionOrder}
          onChangeCustomization={(next) => {
            setCustomization(next);
            setDirty(true);
          }}
          onChangeSectionOrder={(nextOrder) => {
            setContent((prev) => ({ ...prev, sectionOrder: nextOrder }));
            setDirty(true);
          }}
          onResetDefaults={() => {
            setCustomization(resolveTemplateCustomization(templateId));
            setContent((prev) => ({
              ...prev,
              sectionOrder: getEffectiveSectionOrder(prev.sectionOrder, templateId, true),
            }));
            setDirty(true);
          }}
        />
      )}

      {/* Section 7 Targeted AI Optimization Controls */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 mr-1 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-blue-600" />
            <span>AI Section Optimizers:</span>
          </span>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleTargetedOptimize('improve_ats')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50/70 border border-blue-200 rounded-lg hover:bg-blue-100/70 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {optimizingAction === 'improve_ats' ? 'Improving ATS Score...' : 'Improve ATS Score'}
            </span>
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleTargetedOptimize('rewrite_summary')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {optimizingAction === 'rewrite_summary' ? 'Rewriting...' : 'Rewrite Summary'}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleTargetedOptimize('optimize_experience')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {optimizingAction === 'optimize_experience'
              ? 'Optimizing...'
              : 'Optimize Work Experience'}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleTargetedOptimize('optimize_skills')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {optimizingAction === 'optimize_skills'
              ? 'Optimizing...'
              : 'Optimize Skills & Keywords'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowMissingKeywords((v) => !v)}
          className={`px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums ${
            showMissingKeywords
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {showMissingKeywords
            ? 'Hide Missing Keywords'
            : `Show Missing Keywords (${atsAnalysis.missingKeywords.length})`}
        </button>
      </div>

      {/* Collapsible Missing Keywords & Gap Questions Drawer */}
      {showMissingKeywords && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">
              Missing & Partially Matched JD Keywords (Truthful Guidance)
            </span>
            {onViewAtsAnalysis && (
              <button
                type="button"
                onClick={onViewAtsAnalysis}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Open Full ATS Explainer →
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="font-semibold text-slate-800 mb-1">
                Missing Mandatory Skills ({atsAnalysis.missingMandatorySkills?.length ?? 0})
              </div>
              <p className="text-slate-700 leading-relaxed">
                {atsAnalysis.missingMandatorySkills?.join(', ') || 'None detected'}
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-800 mb-1">
                Missing Preferred Skills ({atsAnalysis.missingPreferredSkills?.length ?? 0})
              </div>
              <p className="text-slate-700 leading-relaxed">
                {atsAnalysis.missingPreferredSkills?.join(', ') || 'None detected'}
              </p>
            </div>
            <div>
              <div className="font-semibold text-slate-800 mb-1">
                Partially Matched Terms ({atsAnalysis.partiallyMatchedKeywords.length})
              </div>
              <p className="text-slate-700 leading-relaxed">
                {atsAnalysis.partiallyMatchedKeywords.join(', ') || 'None detected'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Below 75% Honest Explanation & Questions Banner */}
      {finalScore < 75 && (atsAnalysis.belowTargetExplanation || (atsAnalysis.questionsForCandidate?.length ?? 0) > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2 text-xs">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-900 tabular-nums">
                Estimated ATS Score is {finalScore}% (Target &gt; 75% — Best Honest Score Without Inventing Qualifications)
              </div>
              {atsAnalysis.belowTargetExplanation && (
                <p className="text-slate-700 leading-relaxed">{atsAnalysis.belowTargetExplanation}</p>
              )}
              {atsAnalysis.questionsForCandidate && atsAnalysis.questionsForCandidate.length > 0 && (
                <div className="pt-1">
                  <div className="font-semibold text-slate-800 mb-1">
                    Confirm if you actually have experience in any of these before adding them:
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                    {atsAnalysis.questionsForCandidate.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Regeneration Progress */}
      {regenerating && regenProgress && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-900">
            <span>{regenProgress.label}</span>
            <span className="tabular-nums font-mono">
              Step {regenProgress.step} / {regenProgress.total}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.round((regenProgress.step / regenProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Verification & Review Strip */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
            {record.factualVerification.passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
            <span>
              Factual Check: {record.factualVerification.passed ? 'Passed' : 'Attention Needed'}
            </span>
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>AI Reviewer: {record.reviewReport.overallQuality.replace('_', ' ')}</span>
          {atsAnalysis.autoImprovementApplied && (
            <>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="text-blue-700 font-medium">Proactive Optimization Applied</span>
            </>
          )}
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono text-slate-500 tabular-nums">
            {record.aiModel} · v{record.version}
          </span>
        </div>
        {dirty && (
          <span className="text-blue-700 font-medium">
            Unsaved edits reflected in live preview
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {/* Compare Original vs. Optimized View OR Split-Pane Studio */}
      {layoutView === 'compare' ? (
        <OriginalVsOptimizedDiff
          masterData={masterData}
          record={record}
          onBackToStudio={() => setLayoutView('split')}
        />
      ) : (
        <div
          className={`grid gap-6 items-start ${
            layoutView === 'split' ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'
          }`}
        >
          {/* Left Pane: Real-Time Structured Editor */}
          {(layoutView === 'split' || layoutView === 'editor') && (
            <div
              className={`rounded-xl border border-slate-200 bg-white p-5 space-y-6 ${
                layoutView === 'split'
                  ? 'xl:col-span-5 xl:max-h-[82vh] xl:overflow-y-auto'
                  : 'max-w-3xl mx-auto w-full'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Live Content Editor</h2>
                  <p className="text-xs text-slate-500">
                    Edits update the resume preview immediately.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Lock className="w-3 h-3" />
                  <span>Dates & companies locked</span>
                </span>
              </div>

              {/* Profile & Headline */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-800">Profile & Title</h3>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Tailored Professional Title
                  </label>
                  <input
                    type="text"
                    value={content.professionalTitle}
                    onChange={(e) => {
                      setContent({ ...content, professionalTitle: e.target.value });
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      value={content.personalInfo.location}
                      onChange={(e) => {
                        setContent({
                          ...content,
                          personalInfo: { ...content.personalInfo, location: e.target.value },
                        });
                        setDirty(true);
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      LinkedIn URL
                    </label>
                    <input
                      type="text"
                      value={content.personalInfo.linkedin}
                      onChange={(e) => {
                        setContent({
                          ...content,
                          personalInfo: { ...content.personalInfo, linkedin: e.target.value },
                        });
                        setDirty(true);
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-1.5 border-t border-slate-100 pt-4">
                <label className="block text-xs font-semibold text-slate-800">
                  Professional Summary
                </label>
                <textarea
                  rows={4}
                  value={content.professionalSummary}
                  onChange={(e) => {
                    setContent({ ...content, professionalSummary: e.target.value });
                    setDirty(true);
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Core Competencies */}
              <div className="space-y-1.5 border-t border-slate-100 pt-4">
                <label className="block text-xs font-semibold text-slate-800">
                  Core Competencies (comma-separated)
                </label>
                <textarea
                  rows={2}
                  value={content.coreCompetencies.join(', ')}
                  onChange={(e) => {
                    setContent({
                      ...content,
                      coreCompetencies: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    });
                    setDirty(true);
                  }}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Experience Bullet Editor */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-semibold text-slate-800">
                  Work Experience Bullet Points
                </h3>
                {content.professionalExperience.map((exp, expIdx) => (
                  <div
                    key={exp.id || expIdx}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-900">
                        {exp.jobTitle} — {exp.companyName}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums shrink-0">
                        {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {exp.bullets.map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-start gap-1.5">
                          <div className="flex flex-col gap-0.5 pt-1">
                            <button
                              type="button"
                              onClick={() => moveExperienceBullet(expIdx, bIdx, -1)}
                              disabled={bIdx === 0}
                              className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                              title="Move bullet up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveExperienceBullet(expIdx, bIdx, 1)}
                              disabled={bIdx === exp.bullets.length - 1}
                              className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25"
                              title="Move bullet down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={bullet}
                            onChange={(e) => updateExperienceBullet(expIdx, bIdx, e.target.value)}
                            className="flex-1 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-800 leading-relaxed focus:outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => removeExperienceBullet(expIdx, bIdx)}
                            className="p-1.5 text-red-500 hover:text-red-700"
                            title="Remove bullet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addExperienceBullet(expIdx)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Bullet</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Technical Skills & ERP */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    Technical Skills (comma-separated)
                  </label>
                  <textarea
                    rows={2}
                    value={content.technicalSkills.join(', ')}
                    onChange={(e) => {
                      setContent({
                        ...content,
                        technicalSkills: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      });
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">
                    ERP & Software Knowledge (comma-separated)
                  </label>
                  <textarea
                    rows={2}
                    value={content.erpAndSoftwareKnowledge.join(', ')}
                    onChange={(e) => {
                      setContent({
                        ...content,
                        erpAndSoftwareKnowledge: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      });
                      setDirty(true);
                    }}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Section Order */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <h3 className="text-xs font-semibold text-slate-800">Section Order</h3>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {sectionOrder.map((key, idx) => (
                    <div
                      key={key}
                      className="px-3 py-1.5 flex items-center justify-between text-xs text-slate-700"
                    >
                      <span>{SECTION_LABELS[key]}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveSection(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-25"
                          title="Move section up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(idx, 1)}
                          disabled={idx === sectionOrder.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-25"
                          title="Move section down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Right Pane: Real-Time Paper Preview */}
          {(layoutView === 'split' || layoutView === 'preview') && (
            <div
              className={
                layoutView === 'split'
                  ? 'xl:col-span-7 xl:sticky xl:top-4'
                  : 'max-w-[840px] mx-auto w-full'
              }
            >
              <LiveResumeSheet
                content={content}
                templateId={templateId}
                customization={customization}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
