import { ArrowRight, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import type { GeneratedResumeRecord, MasterResumeData } from '../types/resume.ts';

interface OriginalVsOptimizedDiffProps {
  masterData?: MasterResumeData;
  record: GeneratedResumeRecord;
  onBackToStudio?: () => void;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function OriginalVsOptimizedDiff({
  masterData,
  record,
  onBackToStudio,
}: OriginalVsOptimizedDiffProps) {
  const { tailoredResume, atsAnalysis } = record;
  const originalScore = atsAnalysis.originalAtsScore;
  const finalScore = atsAnalysis.estimatedAlignmentScore;
  const scoreDelta =
    typeof originalScore === 'number' ? finalScore - originalScore : null;

  const masterSkillsSet = new Set(
    (masterData?.technicalSkills ?? []).map((s) => normalizeText(s)),
  );
  const tailoredSkillsSet = new Set(
    tailoredResume.technicalSkills.map((s) => normalizeText(s)),
  );

  return (
    <div className="space-y-6">
      {/* Header & Score Lift Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Original Master Resume vs. Optimized Tailored Resume
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Side-by-side comparison showing tailored phrasing, keyword prioritization, and locked factual fields.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {typeof originalScore === 'number' && (
              <div className="flex items-center gap-2 text-xs tabular-nums font-mono">
                <span className="text-slate-500">Original: {originalScore}%</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold text-slate-900">Optimized: {finalScore}%</span>
                {scoreDelta !== null && (
                  <span
                    className={`font-semibold ${
                      scoreDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    ({scoreDelta >= 0 ? '+' : ''}
                    {scoreDelta}%)
                  </span>
                )}
              </div>
            )}
            {onBackToStudio && (
              <button
                type="button"
                onClick={onBackToStudio}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Back to Split Editor
              </button>
            )}
          </div>
        </div>

        {/* What Changed and Why */}
        {atsAnalysis.changesSummary && atsAnalysis.changesSummary.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>What Changed & Why</span>
            </h3>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {atsAnalysis.changesSummary.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 grid grid-cols-1 md:grid-cols-12 gap-2 text-xs"
                >
                  <div className="md:col-span-3 font-semibold text-slate-900">
                    {item.section}
                  </div>
                  <div className="md:col-span-5 text-slate-800">{item.change}</div>
                  <div className="md:col-span-4 text-slate-600">{item.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Headline & Summary Comparison */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900">
            1. Professional Title & Summary
          </span>
          <span className="text-[11px] text-slate-500">
            Rewritten for {record.jobTitle}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="p-5 space-y-2">
            <div className="text-[11px] font-semibold text-slate-500">
              ORIGINAL MASTER RESUME
            </div>
            {masterData ? (
              <>
                <div className="text-xs font-semibold text-slate-800">
                  {masterData.headline || 'No headline set'}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {masterData.professionalSummary || 'No summary recorded in Master Resume.'}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Original Master Resume data is unavailable for comparison.
              </p>
            )}
          </div>

          <div className="p-5 space-y-2 bg-blue-50/20">
            <div className="text-[11px] font-semibold text-blue-700">
              OPTIMIZED TAILORED RESUME
            </div>
            <div className="text-xs font-semibold text-slate-900">
              {tailoredResume.professionalTitle}
            </div>
            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {tailoredResume.professionalSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Work Experience Side-by-Side */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900">
            2. Work Experience Bullet Comparison
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Lock className="w-3 h-3" />
            <span>Companies, job titles, and dates locked identically</span>
          </span>
        </div>

        <div className="divide-y divide-slate-200">
          {tailoredResume.professionalExperience.map((optExp, idx) => {
            const origExp =
              masterData?.employmentHistory.find(
                (m) =>
                  normalizeText(m.companyName) === normalizeText(optExp.companyName) &&
                  normalizeText(m.jobTitle) === normalizeText(optExp.jobTitle),
              ) || masterData?.employmentHistory[idx];

            const origBullets = origExp
              ? [...origExp.responsibilities, ...origExp.achievements]
              : [];
            const origSet = new Set(origBullets.map((b) => normalizeText(b)));

            return (
              <div
                key={optExp.id || idx}
                className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
              >
                <div className="p-5 space-y-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-800">
                      {origExp?.jobTitle || optExp.jobTitle} — {origExp?.companyName || optExp.companyName}
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums shrink-0">
                      {origExp?.startDate || optExp.startDate} –{' '}
                      {(origExp?.isCurrent ?? optExp.isCurrent)
                        ? 'Present'
                        : origExp?.endDate || optExp.endDate}
                    </div>
                  </div>
                  {origBullets.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-slate-600 leading-relaxed list-disc pl-4">
                      {origBullets.map((b, bIdx) => (
                        <li key={bIdx}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      No original bullets available for this role.
                    </p>
                  )}
                </div>

                <div className="p-5 space-y-2.5 bg-blue-50/20">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-900">
                      {optExp.jobTitle} — {optExp.companyName}
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums shrink-0">
                      {optExp.startDate} – {optExp.isCurrent ? 'Present' : optExp.endDate}
                    </div>
                  </div>
                  <ul className="space-y-2 text-xs leading-relaxed">
                    {optExp.bullets.map((b, bIdx) => {
                      const unchanged = origSet.has(normalizeText(b));
                      return (
                        <li
                          key={bIdx}
                          className={`rounded-md px-2.5 py-1.5 border ${
                            unchanged
                              ? 'border-transparent text-slate-700'
                              : 'border-blue-200 bg-white text-slate-900'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                unchanged ? 'text-slate-400' : 'text-blue-600'
                              }`}
                            />
                            <div>
                              <span>{b}</span>
                              {!unchanged && (
                                <span className="ml-2 text-[10px] font-semibold text-blue-700">
                                  Optimized
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills & ERP Comparison */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900">
            3. Skills, Core Competencies & ERP Prioritization
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          <div className="p-5 space-y-3">
            <div className="text-[11px] font-semibold text-slate-500">
              ORIGINAL MASTER SKILLS & ERP
            </div>
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-800">Technical Skills: </span>
              {masterData?.technicalSkills.join(', ') || 'None listed'}
            </div>
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-800">ERP / Systems: </span>
              {masterData?.erpKnowledge.join(', ') || 'None listed'}
            </div>
            {masterData && masterData.procurementExperience.length > 0 && (
              <div className="text-xs text-slate-700 leading-relaxed">
                <span className="font-semibold text-slate-800">Procurement Scope: </span>
                {masterData.procurementExperience.join(', ')}
              </div>
            )}
          </div>

          <div className="p-5 space-y-3 bg-blue-50/20">
            <div className="text-[11px] font-semibold text-blue-700">
              OPTIMIZED & PRIORITIZED FOR JD
            </div>
            <div className="text-xs text-slate-800 leading-relaxed">
              <span className="font-semibold text-slate-900">Core Competencies: </span>
              {tailoredResume.coreCompetencies.join(', ') || 'None listed'}
            </div>
            <div className="text-xs text-slate-800 leading-relaxed">
              <span className="font-semibold text-slate-900">Prioritized Technical Skills: </span>
              {tailoredResume.technicalSkills.map((skill, idx) => {
                const isReworded = !masterSkillsSet.has(normalizeText(skill));
                return (
                  <span key={idx}>
                    {idx > 0 ? ', ' : ''}
                    <span className={isReworded ? 'font-semibold text-blue-800' : ''}>
                      {skill}
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="text-xs text-slate-800 leading-relaxed">
              <span className="font-semibold text-slate-900">ERP & Software: </span>
              {tailoredResume.erpAndSoftwareKnowledge.join(', ') || 'None listed'}
            </div>
            {masterData && (
              <div className="text-[11px] text-slate-500 pt-1">
                Omitted from Master list to reduce noise:{' '}
                {masterData.technicalSkills
                  .filter((s) => !tailoredSkillsSet.has(normalizeText(s)))
                  .join(', ') || 'None'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
