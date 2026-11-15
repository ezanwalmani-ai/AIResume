import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import {
  RESUME_TEMPLATES,
  TEMPLATE_CATEGORY_META,
  normalizeTemplateId,
} from '../lib/templates.ts';
import type { ResumeTemplateId, TemplateCategory } from '../types/resume.ts';
import { TemplateThumbnail } from './TemplateLibraryView.tsx';

interface TemplateSelectorProps {
  value: ResumeTemplateId;
  recommendedId?: ResumeTemplateId | null;
  onChange: (templateId: ResumeTemplateId) => void;
  onOpenFullLibrary?: () => void;
  disabled?: boolean;
}

export function TemplateSelector({
  value,
  recommendedId,
  onChange,
  onOpenFullLibrary,
  disabled = false,
}: TemplateSelectorProps) {
  const activeId = normalizeTemplateId(value);
  const normRecId = recommendedId ? normalizeTemplateId(recommendedId) : null;
  const [activeCat, setActiveCat] = useState<'all' | TemplateCategory>('all');

  const items = RESUME_TEMPLATES.filter(
    (t) => activeCat === 'all' || t.category === activeCat,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveCat('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activeCat === 'all'
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
              onClick={() => setActiveCat(cat.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeCat === cat.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {onOpenFullLibrary && (
          <button
            type="button"
            onClick={onOpenFullLibrary}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Open Full Preview Library →
          </button>
        )}
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[380px] overflow-y-auto pr-1"
        role="radiogroup"
        aria-label="Choose Resume Template"
      >
        {items.map((tpl) => {
          const selected = activeId === tpl.id;
          const isRec = normRecId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(tpl.id)}
              className={`text-left rounded-xl border p-3 transition-colors flex flex-col justify-between gap-2.5 disabled:opacity-50 ${
                selected
                  ? 'border-blue-600 bg-blue-50/40'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="space-y-2">
                <TemplateThumbnail template={tpl} />
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-semibold text-slate-900">{tpl.name}</span>
                    {selected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </div>
                  {isRec && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700">
                      <Sparkles className="w-3 h-3" />
                      <span>AI Recommended</span>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-slate-600 leading-snug line-clamp-2">
                    {tpl.description}
                  </p>
                </div>
              </div>

              <div
                className={`text-[10px] font-semibold border-t border-slate-100 pt-1.5 ${
                  tpl.atsClassification === 'ats_friendly'
                    ? 'text-emerald-700'
                    : tpl.atsClassification === 'ats_caution'
                      ? 'text-amber-700'
                      : 'text-red-700'
                }`}
              >
                {tpl.atsLabel}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
