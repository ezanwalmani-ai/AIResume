import { useState } from 'react';
import {
  Check,
  CopyPlus,
  Download,
  Eye,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  RESUME_TEMPLATES,
  TEMPLATE_CATEGORY_META,
  getEffectiveSectionOrder,
  getTemplateDefinition,
  masterDataToPreviewContent,
  normalizeTemplateId,
  resolveTemplateCustomization,
  type TemplateDefinition,
} from '../lib/templates.ts';
import {
  apiDownloadExport,
  apiDuplicateResumeWithTemplate,
  apiUpdateResume,
  triggerBlobDownload,
} from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type {
  AtsClassification,
  GeneratedResumeRecord,
  MasterResumeRecord,
  ResumeSectionKey,
  ResumeTemplateId,
  TemplateCategory,
  TemplateCustomization,
} from '../types/resume.ts';
import { LiveResumeSheet } from './LiveResumeSheet.tsx';
import { TemplateCustomizer } from './TemplateCustomizer.tsx';

interface TemplateLibraryViewProps {
  masterResume: MasterResumeRecord | null;
  activeResume: GeneratedResumeRecord | null;
  defaultTemplate: ResumeTemplateId;
  onApplyToActiveResume: (updated: GeneratedResumeRecord) => void;
  onSavedAsNewVersion: (created: GeneratedResumeRecord) => void;
  onUseForNewResume: (
    templateId: ResumeTemplateId,
    customization: TemplateCustomization,
  ) => void;
}

export function TemplateThumbnail({ template }: { template: TemplateDefinition }) {
  const cfg = template.defaultCustomization;
  const isTwoCol = cfg.layout !== 'single_column';
  const leftSidebar = cfg.layout === 'two_column_left';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 h-36 overflow-hidden">
      {/* Mini Header */}
      <div
        className={`pb-1.5 ${
          cfg.headerStyle === 'dark_banner'
            ? 'rounded px-2 py-1.5 text-white'
            : cfg.headerStyle === 'tinted_band'
              ? 'rounded bg-slate-50 px-2 py-1 border-l-2'
              : cfg.headerStyle === 'top_accent_bar'
                ? 'border-t-2 pt-1'
                : 'border-b border-slate-200'
        } ${cfg.headerStyle === 'centered' ? 'text-center' : 'text-left'}`}
        style={{
          backgroundColor:
            cfg.headerStyle === 'dark_banner' ? cfg.primaryColor : undefined,
          borderColor:
            cfg.headerStyle === 'tinted_band' || cfg.headerStyle === 'top_accent_bar'
              ? cfg.primaryColor
              : undefined,
        }}
      >
        <div
          className={`h-2 w-24 rounded-sm ${
            cfg.headerStyle === 'dark_banner' ? 'bg-white' : 'bg-slate-900'
          } ${cfg.headerStyle === 'centered' ? 'mx-auto' : ''}`}
        />
        <div
          className={`mt-1 h-1.5 w-16 rounded-sm ${
            cfg.headerStyle === 'centered' ? 'mx-auto' : ''
          }`}
          style={{
            backgroundColor:
              cfg.headerStyle === 'dark_banner' ? '#CBD5E1' : cfg.primaryColor,
          }}
        />
      </div>

      {/* Mini Body Wireframe */}
      {isTwoCol ? (
        <div className="grid grid-cols-12 gap-2 pt-0.5">
          {leftSidebar ? (
            <>
              <div className="col-span-4 rounded bg-slate-50 p-1.5 space-y-1.5">
                <div
                  className="h-1 w-8 rounded-sm"
                  style={{ backgroundColor: cfg.primaryColor }}
                />
                <div className="h-1 w-full rounded-sm bg-slate-200" />
                <div className="h-1 w-4/5 rounded-sm bg-slate-200" />
                {cfg.showSkillBars && (
                  <div
                    className="h-1 w-5/6 rounded-sm"
                    style={{ backgroundColor: cfg.primaryColor }}
                  />
                )}
              </div>
              <div className="col-span-8 space-y-1.5 pt-0.5">
                <div
                  className="h-1 w-14 rounded-sm"
                  style={{ backgroundColor: cfg.primaryColor }}
                />
                <div className="h-1 w-full rounded-sm bg-slate-200" />
                <div className="h-1 w-5/6 rounded-sm bg-slate-200" />
                <div className="h-1 w-full rounded-sm bg-slate-200" />
              </div>
            </>
          ) : (
            <>
              <div className="col-span-8 space-y-1.5 pt-0.5">
                <div
                  className="h-1 w-14 rounded-sm"
                  style={{ backgroundColor: cfg.primaryColor }}
                />
                <div className="h-1 w-full rounded-sm bg-slate-200" />
                <div className="h-1 w-5/6 rounded-sm bg-slate-200" />
                <div className="h-1 w-full rounded-sm bg-slate-200" />
              </div>
              <div className="col-span-4 rounded bg-slate-50 p-1.5 space-y-1.5">
                <div
                  className="h-1 w-8 rounded-sm"
                  style={{ backgroundColor: cfg.primaryColor }}
                />
                <div className="h-1 w-full rounded-sm bg-slate-200" />
                <div className="h-1 w-4/5 rounded-sm bg-slate-200" />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2 pt-0.5">
          <div className="space-y-1">
            <div
              className="h-1.5 w-14 rounded-sm"
              style={{ backgroundColor: cfg.primaryColor }}
            />
            <div className="h-1 w-full rounded-sm bg-slate-200" />
            <div className="h-1 w-5/6 rounded-sm bg-slate-200" />
          </div>
          <div className="space-y-1">
            <div
              className="h-1.5 w-16 rounded-sm"
              style={{ backgroundColor: cfg.primaryColor }}
            />
            <div className="h-1 w-full rounded-sm bg-slate-200" />
            <div className="h-1 w-4/5 rounded-sm bg-slate-200" />
          </div>
        </div>
      )}
    </div>
  );
}

export function TemplateLibraryView({
  masterResume,
  activeResume,
  defaultTemplate,
  onApplyToActiveResume,
  onSavedAsNewVersion,
  onUseForNewResume,
}: TemplateLibraryViewProps) {
  const { getToken } = useAuth();

  const [categoryFilter, setCategoryFilter] = useState<'all' | TemplateCategory>('all');
  const [atsFilter, setAtsFilter] = useState<'all' | AtsClassification>('all');
  const [query, setQuery] = useState('');

  const initialSelected = normalizeTemplateId(
    activeResume?.templateId || defaultTemplate,
  );
  const [previewTemplateId, setPreviewTemplateId] = useState<ResumeTemplateId | null>(null);
  const [customization, setCustomization] = useState<TemplateCustomization>(() =>
    resolveTemplateCustomization(initialSelected, activeResume?.templateCustomization),
  );
  const [sectionOrder, setSectionOrder] = useState<ResumeSectionKey[]>(() =>
    getEffectiveSectionOrder(
      activeResume?.tailoredResume.sectionOrder,
      initialSelected,
    ),
  );
  const [showCustomizerInModal, setShowCustomizerInModal] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewSourceContent = activeResume
    ? {
        ...activeResume.tailoredResume,
        sectionOrder,
      }
    : {
        ...masterDataToPreviewContent(masterResume?.structuredData),
        sectionOrder,
      };

  const recommendedId = activeResume?.jdAnalysis.templateRecommendation?.recommendedTemplateId
    ? normalizeTemplateId(activeResume.jdAnalysis.templateRecommendation.recommendedTemplateId)
    : null;

  const filteredTemplates = RESUME_TEMPLATES.filter((tpl) => {
    const matchesCat = categoryFilter === 'all' || tpl.category === categoryFilter;
    const matchesAts = atsFilter === 'all' || tpl.atsClassification === atsFilter;
    const q = query.trim().toLowerCase();
    const matchesSearch =
      !q ||
      tpl.name.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.recommendedFor.some((r) => r.toLowerCase().includes(q));
    return matchesCat && matchesAts && matchesSearch;
  });

  const openPreview = (tplId: ResumeTemplateId) => {
    const def = getTemplateDefinition(tplId);
    setPreviewTemplateId(def.id);
    setCustomization(resolveTemplateCustomization(def.id));
    setSectionOrder(
      getEffectiveSectionOrder(activeResume?.tailoredResume.sectionOrder, def.id, true),
    );
    setShowCustomizerInModal(false);
    setError(null);
    setNotice(null);
  };

  const handleApplyTemplate = async (
    targetId: ResumeTemplateId,
    customCfg?: TemplateCustomization,
    customOrder?: ResumeSectionKey[],
  ) => {
    setError(null);
    setNotice(null);
    const resolvedCfg = customCfg || resolveTemplateCustomization(targetId);

    if (!activeResume) {
      onUseForNewResume(targetId, resolvedCfg);
      setPreviewTemplateId(null);
      return;
    }

    setBusyAction('apply');
    try {
      const token = await getToken();
      const updated = await apiUpdateResume(token, activeResume.id, {
        templateId: targetId,
        templateCustomization: resolvedCfg,
        tailoredResume: {
          ...activeResume.tailoredResume,
          sectionOrder:
            customOrder ||
            getEffectiveSectionOrder(activeResume.tailoredResume.sectionOrder, targetId),
        },
      });
      onApplyToActiveResume(updated);
      setNotice(`Applied "${getTemplateDefinition(targetId).name}" to v${updated.version}.`);
      setPreviewTemplateId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveAsNewVersion = async (
    targetId: ResumeTemplateId,
    customCfg: TemplateCustomization,
    customOrder: ResumeSectionKey[],
  ) => {
    if (!activeResume) return;
    setError(null);
    setNotice(null);
    setBusyAction('duplicate');
    try {
      const token = await getToken();
      const created = await apiDuplicateResumeWithTemplate(token, activeResume.id, {
        templateId: targetId,
        templateCustomization: customCfg,
        tailoredResume: {
          ...activeResume.tailoredResume,
          sectionOrder: customOrder,
        },
      });
      onSavedAsNewVersion(created);
      setNotice(
        `Saved separate version v${created.version} (${activeResume.jobTitle} – ${getTemplateDefinition(targetId).name}).`,
      );
      setPreviewTemplateId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save new resume version.');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreviewDownload = async (format: 'pdf' | 'docx') => {
    if (!previewTemplateId) return;
    setError(null);
    setBusyAction(format);
    try {
      const token = await getToken();
      const { blob, filename, validation } = await apiDownloadExport(token, format, {
        tailoredResume: previewSourceContent,
        templateId: previewTemplateId,
        templateCustomization: customization,
        jobTitle: activeResume?.jobTitle || previewSourceContent.professionalTitle,
        companyName: activeResume?.companyName || 'ResumeAI',
      });
      triggerBlobDownload(blob, filename);
      setNotice(
        `Downloaded ${filename}${
          validation?.valid ? ' · Selectable text & reading order verified.' : ''
        }`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const previewDef = previewTemplateId ? getTemplateDefinition(previewTemplateId) : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Resume Templates Library (20 Designs)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse ATS-Friendly Professional, Modern Corporate, Creative, and Industry-Specific
            resume designs. Changing a template never alters your verified resume content.
          </p>
        </div>

        {activeResume && (
          <div className="text-xs text-slate-600 text-right">
            <div className="font-semibold text-slate-900">
              Active Target: {activeResume.jobTitle}
            </div>
            <div className="tabular-nums">
              v{activeResume.version} · {getTemplateDefinition(activeResume.templateId).name}
            </div>
          </div>
        )}
      </div>

      {/* AI Recommendation Callout if JD already analyzed */}
      {activeResume?.jdAnalysis.templateRecommendation && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1 max-w-3xl text-xs">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>
                AI Recommended Template for {activeResume.jobTitle}:{' '}
                {getTemplateDefinition(
                  activeResume.jdAnalysis.templateRecommendation.recommendedTemplateId,
                ).name}
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              {activeResume.jdAnalysis.templateRecommendation.reason}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              openPreview(
                normalizeTemplateId(
                  activeResume.jdAnalysis.templateRecommendation!.recommendedTemplateId,
                ),
              )
            }
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            Preview Recommended
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              categoryFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All (20)
          </button>
          {TEMPLATE_CATEGORY_META.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === cat.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={atsFilter}
            onChange={(e) => setAtsFilter(e.target.value as 'all' | AtsClassification)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="all">All ATS Tiers</option>
            <option value="ats_friendly">ATS-Friendly Only</option>
            <option value="ats_caution">ATS-Compatible with Caution</option>
            <option value="creative_not_recommended">Creative / Visual</option>
          </select>

          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates or roles..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 20-Template Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTemplates.map((tpl) => {
          const isCurrentActive =
            activeResume && normalizeTemplateId(activeResume.templateId) === tpl.id;
          const isAiRecommended = recommendedId === tpl.id;
          const atsColorClass =
            tpl.atsClassification === 'ats_friendly'
              ? 'text-emerald-700'
              : tpl.atsClassification === 'ats_caution'
                ? 'text-amber-700'
                : 'text-red-700';

          return (
            <div
              key={tpl.id}
              className={`rounded-xl border bg-white p-4 flex flex-col justify-between gap-4 transition-colors ${
                isCurrentActive
                  ? 'border-blue-600 ring-1 ring-blue-600/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                <TemplateThumbnail template={tpl} />

                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{tpl.name}</h2>
                    {isCurrentActive && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {tpl.categoryLabel}
                    {isAiRecommended ? ' · AI Recommended' : ''}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
                    {tpl.description}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className={`text-[11px] font-semibold ${atsColorClass}`}>
                  {tpl.atsLabel}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openPreview(tpl.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => void handleApplyTemplate(tpl.id)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {activeResume ? 'Select Template' : 'Use Template'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-Resume Interactive Preview + Customizer Modal */}
      {previewTemplateId && previewDef && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-slate-50 rounded-xl border border-slate-200 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {previewDef.name} — Full Resume Preview
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {previewDef.categoryLabel} · {previewDef.atsLabel}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomizerInModal((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    showCustomizerInModal
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{showCustomizerInModal ? 'Hide Customizer' : 'Customize Design'}</span>
                </button>

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handlePreviewDownload('docx')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOCX</span>
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void handlePreviewDownload('pdf')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>

                {activeResume && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void handleSaveAsNewVersion(
                        previewTemplateId,
                        customization,
                        sectionOrder,
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 border border-slate-300 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <CopyPlus className="w-3.5 h-3.5" />
                    <span>Save as New Version</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() =>
                    void handleApplyTemplate(
                      previewTemplateId,
                      customization,
                      sectionOrder,
                    )
                  }
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {activeResume ? 'Apply to Resume' : 'Select Template'}
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTemplateId(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-900"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {showCustomizerInModal && (
                <TemplateCustomizer
                  templateId={previewTemplateId}
                  customization={customization}
                  sectionOrder={sectionOrder}
                  onChangeCustomization={setCustomization}
                  onChangeSectionOrder={setSectionOrder}
                  onResetDefaults={() => {
                    setCustomization(resolveTemplateCustomization(previewTemplateId));
                    setSectionOrder(
                      getEffectiveSectionOrder(
                        activeResume?.tailoredResume.sectionOrder,
                        previewTemplateId,
                        true,
                      ),
                    );
                  }}
                />
              )}

              <div className="max-w-[840px] mx-auto">
                <LiveResumeSheet
                  content={previewSourceContent}
                  templateId={previewTemplateId}
                  customization={customization}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
