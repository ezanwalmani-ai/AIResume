import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import {
  COLOR_PRESETS,
  getTemplateDefinition,
  resolveTemplateCustomization,
} from '../lib/templates.ts';
import {
  DEFAULT_SECTION_ORDER,
  type ResumeSectionKey,
  type ResumeTemplateId,
  type TemplateCustomization,
} from '../types/resume.ts';

interface TemplateCustomizerProps {
  templateId: ResumeTemplateId;
  customization: TemplateCustomization;
  sectionOrder: ResumeSectionKey[];
  onChangeCustomization: (next: TemplateCustomization) => void;
  onChangeSectionOrder: (next: ResumeSectionKey[]) => void;
  onResetDefaults: () => void;
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

export function TemplateCustomizer({
  templateId,
  customization,
  sectionOrder,
  onChangeCustomization,
  onChangeSectionOrder,
  onResetDefaults,
}: TemplateCustomizerProps) {
  const def = getTemplateDefinition(templateId);
  const cfg = resolveTemplateCustomization(templateId, customization);
  const effectiveOrder =
    sectionOrder.length > 0 ? sectionOrder : [...DEFAULT_SECTION_ORDER];

  const moveSection = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= effectiveOrder.length) return;
    const next = [...effectiveOrder];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChangeSectionOrder(next);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Customize Design — {def.name}
          </h3>
          <p className="text-xs text-slate-500">
            Changes apply instantaneously without altering your verified resume content.
          </p>
        </div>
        <button
          type="button"
          onClick={onResetDefaults}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Template Default</span>
        </button>
      </div>

      {/* Color Presets + Custom Primary/Secondary */}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-slate-800">
          Professional Colour Schemes
        </label>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset) => {
            const active =
              cfg.primaryColor.toLowerCase() === preset.primaryColor.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onChangeCustomization({
                    ...cfg,
                    primaryColor: preset.primaryColor,
                    secondaryColor: preset.secondaryColor,
                  })
                }
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0 border border-slate-300"
                  style={{ backgroundColor: preset.primaryColor }}
                />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <div className="flex items-center gap-2.5">
            <input
              type="color"
              value={cfg.primaryColor}
              onChange={(e) =>
                onChangeCustomization({ ...cfg, primaryColor: e.target.value })
              }
              aria-label="Primary colour"
              className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
            />
            <div className="text-xs">
              <div className="font-medium text-slate-800">Primary Colour</div>
              <div className="font-mono text-[11px] text-slate-500">{cfg.primaryColor}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              type="color"
              value={cfg.secondaryColor}
              onChange={(e) =>
                onChangeCustomization({ ...cfg, secondaryColor: e.target.value })
              }
              aria-label="Secondary colour"
              className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
            />
            <div className="text-xs">
              <div className="font-medium text-slate-800">Secondary Colour</div>
              <div className="font-mono text-[11px] text-slate-500">{cfg.secondaryColor}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Typography & Heading Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-100 pt-4 text-xs">
        <div>
          <label className="block font-medium text-slate-600 mb-1">Font Family</label>
          <select
            value={cfg.fontFamily}
            onChange={(e) =>
              onChangeCustomization({
                ...cfg,
                fontFamily: e.target.value as TemplateCustomization['fontFamily'],
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
          >
            <option value="sans">Modern Sans-Serif</option>
            <option value="serif">Executive Serif</option>
            <option value="georgia_sans">Serif Headings + Sans Body</option>
            <option value="mono_accent">Sans + Monospace Dates</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Font Size</label>
          <select
            value={cfg.fontSize}
            onChange={(e) =>
              onChangeCustomization({
                ...cfg,
                fontSize: e.target.value as TemplateCustomization['fontSize'],
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
          >
            <option value="compact">Compact (9pt)</option>
            <option value="standard">Standard (9.6pt)</option>
            <option value="large">Large (10.5pt)</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Heading Style</label>
          <select
            value={cfg.headingStyle}
            onChange={(e) =>
              onChangeCustomization({
                ...cfg,
                headingStyle: e.target.value as TemplateCustomization['headingStyle'],
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
          >
            <option value="uppercase_rule">Bold Rule Divider</option>
            <option value="clean_underline">Clean Hairline</option>
            <option value="left_bar">Left Accent Bar</option>
            <option value="solid_banner">Solid Colour Banner</option>
            <option value="accent_tag">Short Accent Underline</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Header Style</label>
          <select
            value={cfg.headerStyle}
            onChange={(e) =>
              onChangeCustomization({
                ...cfg,
                headerStyle: e.target.value as TemplateCustomization['headerStyle'],
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
          >
            <option value="centered">Centered Classic</option>
            <option value="left_clean">Left Clean</option>
            <option value="top_accent_bar">Top Accent Rule</option>
            <option value="tinted_band">Tinted Executive Band</option>
            <option value="dark_banner">Full Dark Banner</option>
            <option value="split_box">Split Contact Header</option>
          </select>
        </div>
      </div>

      {/* Spacing, Margins & Column Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-t border-slate-100 pt-4 text-xs">
        <div>
          <label className="block font-medium text-slate-600 mb-1">Section Spacing</label>
          <select
            value={cfg.sectionSpacing}
            onChange={(e) =>
              onChangeCustomization({
                ...cfg,
                sectionSpacing: e.target.value as TemplateCustomization['sectionSpacing'],
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
          >
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Line Spacing</label>
          <select
            value={cfg.lineSpacing}
            onChange={(e) =>
              onChangeCustomization({
                ...cfg,
                lineSpacing: e.target.value as TemplateCustomization['lineSpacing'],
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
          >
            <option value="tight">Tight</option>
            <option value="normal">Normal</option>
            <option value="airy">Airy</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Page Margins</label>
          <select
            value={cfg.pageMargin}
            onChange={(e) =>
              onChangeCustomization({
                ...cfg,
                pageMargin: e.target.value as TemplateCustomization['pageMargin'],
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
          >
            <option value="narrow">Narrow (0.5 in)</option>
            <option value="standard">Standard (0.65 in)</option>
            <option value="wide">Wide (0.8 in)</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Column Layout</label>
          <select
            value={cfg.layout}
            onChange={(e) =>
              onChangeCustomization({
                ...cfg,
                layout: e.target.value as TemplateCustomization['layout'],
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800"
          >
            <option value="single_column">Single Column (Best ATS)</option>
            <option value="two_column_left">Two-Column (Left Sidebar)</option>
            <option value="two_column_right">Two-Column (Right Sidebar)</option>
          </select>
        </div>
      </div>

      {/* Profile Photo & Section Order */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
        <div className="space-y-2.5">
          <div className="font-semibold text-slate-800">Visual Elements</div>
          <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.showPhoto}
              onChange={(e) =>
                onChangeCustomization({ ...cfg, showPhoto: e.target.checked })
              }
              className="rounded border-slate-300 text-blue-600"
            />
            <span>Show profile photo / monogram badge (non-centered headers)</span>
          </label>
          <label className="flex items-center gap-2.5 text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(cfg.showSkillBars)}
              onChange={(e) =>
                onChangeCustomization({ ...cfg, showSkillBars: e.target.checked })
              }
              className="rounded border-slate-300 text-blue-600"
            />
            <span>Show visual competency bars (Creative / Infographic preview)</span>
          </label>
        </div>

        <div className="space-y-2">
          <div className="font-semibold text-slate-800">Section Order</div>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {effectiveOrder.map((key, idx) => (
              <div
                key={key}
                className="px-3 py-1.5 flex items-center justify-between text-slate-700"
              >
                <span>{SECTION_LABELS[key]}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSection(idx, -1)}
                    disabled={idx === 0}
                    className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-25"
                    title="Move up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(idx, 1)}
                    disabled={idx === effectiveOrder.length - 1}
                    className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-25"
                    title="Move down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
