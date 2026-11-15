import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Info,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { apiExplainAtsKeywords, apiOptimizeResume } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { AtsKeywordExplanation, GeneratedResumeRecord } from '../types/resume.ts';

interface AtsAnalysisViewProps {
  resumes: GeneratedResumeRecord[];
  selectedResume: GeneratedResumeRecord | null;
  onSelectResume: (record: GeneratedResumeRecord) => void;
  onResumeUpdated: (record: GeneratedResumeRecord) => void;
  onOpenEditor: (record: GeneratedResumeRecord) => void;
}

export function AtsAnalysisView({
  resumes,
  selectedResume,
  onSelectResume,
  onResumeUpdated,
  onOpenEditor,
}: AtsAnalysisViewProps) {
  const { getToken } = useAuth();
  const [filterId, setFilterId] = useState<number | null>(selectedResume?.id ?? null);
  const [explainerCategory, setExplainerCategory] = useState<
    'all' | 'matched' | 'partial' | 'missing'
  >('all');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [improving, setImproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const current =
    resumes.find((r) => r.id === (selectedResume?.id ?? filterId)) ?? resumes[0] ?? null;

  if (!current) {
    return (
      <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-8 space-y-3">
        <h1 className="text-xl font-bold text-slate-900">ATS & Factual Audit</h1>
        <p className="text-sm text-slate-600">
          No tailored resumes have been generated yet. Generate a tailored resume from a job
          description to inspect the 6-category weighted ATS scorecard, keyword explainer, missing
          mandatory/preferred skills, and factual verification.
        </p>
      </div>
    );
  }

  const { atsAnalysis, jdAnalysis, factualVerification, reviewReport } = current;
  const explanations: AtsKeywordExplanation[] = atsAnalysis.keywordExplanations ?? [];

  const filteredExplanations = explanations.filter((item) => {
    const matchesCat = explainerCategory === 'all' || item.category === explainerCategory;
    const q = keywordQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.keyword.toLowerCase().includes(q) ||
      item.significance.toLowerCase().includes(q) ||
      item.suggestion.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleGenerateExplanations = async () => {
    setActionError(null);
    setExplaining(true);
    try {
      const token = await getToken();
      const updated = await apiExplainAtsKeywords(token, current.id);
      onResumeUpdated(updated);
      onSelectResume(updated);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to generate keyword explanations.',
      );
    } finally {
      setExplaining(false);
    }
  };

  const handleRunImproveAts = async () => {
    setActionError(null);
    setImproving(true);
    try {
      const token = await getToken();
      const result = await apiOptimizeResume(token, current.id, 'improve_ats');
      onResumeUpdated(result.resume);
      onSelectResume(result.resume);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to improve ATS score.');
    } finally {
      setImproving(false);
    }
  };

  const reviewerCriteria: Array<{ label: string; passed: boolean }> = [
    { label: 'Matches target job description', passed: reviewReport.checks.matchesJd },
    { label: 'Professional summary is relevant', passed: reviewReport.checks.summaryRelevant },
    { label: 'Keywords incorporated naturally', passed: reviewReport.checks.keywordsIncludedNaturally },
    {
      label: 'Experience represented accurately',
      passed: reviewReport.checks.experienceAccuratelyRepresented,
    },
    { label: 'No invented information', passed: reviewReport.checks.noInventedInformation },
    {
      label: 'Dates, titles, and companies unchanged',
      passed: reviewReport.checks.datesAndCompaniesUnchanged,
    },
    { label: 'ATS-friendly single-column structure', passed: reviewReport.checks.atsFriendly },
    {
      label: 'Grammar and formatting professional',
      passed: reviewReport.checks.grammarAndFormattingProfessional,
    },
  ];

  const immutableChecks: Array<{ label: string; ok: boolean }> = [
    { label: 'Full Name', ok: factualVerification.immutableFieldsVerified.fullNameMatch },
    { label: 'Contact Details', ok: factualVerification.immutableFieldsVerified.contactDetailsMatch },
    { label: 'Company Names', ok: factualVerification.immutableFieldsVerified.companyNamesMatch },
    { label: 'Employment Dates', ok: factualVerification.immutableFieldsVerified.employmentDatesMatch },
    { label: 'Job Titles', ok: factualVerification.immutableFieldsVerified.jobTitlesMatch },
    { label: 'Education', ok: factualVerification.immutableFieldsVerified.educationMatch },
    { label: 'Certifications', ok: factualVerification.immutableFieldsVerified.certificationsMatch },
  ];

  const finalScore = atsAnalysis.estimatedAlignmentScore;
  const originalScore = atsAnalysis.originalAtsScore;
  const scoreLift = typeof originalScore === 'number' ? finalScore - originalScore : null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            ATS Scoring Engine & Factual Audit
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            6-category weighted ATS scorecard (target &gt; 75%), before-and-after breakdown,
            keyword explainer, and factual consistency audit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={current.id}
            onChange={(e) => {
              const id = Number(e.target.value);
              setFilterId(id);
              const found = resumes.find((r) => r.id === id);
              if (found) onSelectResume(found);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 max-w-xs"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                v{r.version} · {r.jobTitle} ({r.companyName})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={improving}
            onClick={() => void handleRunImproveAts()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50/70 rounded-lg hover:bg-blue-100/70 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{improving ? 'Optimizing...' : 'Improve ATS Score'}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenEditor(current)}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            Open Live Editor
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {actionError}
        </div>
      )}

      {/* KPI Summary Strip: Before -> After + Sub-Percentages */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-start">
          <div>
            <div className="text-xs font-medium text-slate-500">Original Resume ATS</div>
            <div className="mt-1 text-2xl font-bold text-slate-700 tabular-nums font-mono">
              {typeof originalScore === 'number' ? `${originalScore}%` : '—'}
            </div>
            <div className="text-[11px] text-slate-500">Before optimization</div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500">Optimized ATS Score</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`text-3xl font-bold tracking-tight tabular-nums font-mono ${
                  finalScore >= 75 ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {finalScore}%
              </span>
              {scoreLift !== null && (
                <span className="text-xs font-semibold text-emerald-700 tabular-nums font-mono">
                  {scoreLift >= 0 ? `+${scoreLift}%` : `${scoreLift}%`}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-600">
              {finalScore >= 75 ? 'Above 75% target' : 'Below 75% target'}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500">JD Keyword Match</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {typeof atsAnalysis.keywordMatchPercentage === 'number'
                ? `${atsAnalysis.keywordMatchPercentage}%`
                : '—'}
            </div>
            <div className="text-[11px] text-slate-500">Target terms covered</div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500">Skills Match</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {typeof atsAnalysis.skillsMatchPercentage === 'number'
                ? `${atsAnalysis.skillsMatchPercentage}%`
                : '—'}
            </div>
            <div className="text-[11px] text-slate-500">Mandatory & tech tools</div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500">Experience Relevance</div>
            <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {typeof atsAnalysis.experienceRelevancePercentage === 'number'
                ? `${atsAnalysis.experienceRelevancePercentage}%`
                : '—'}
            </div>
            <div className="text-[11px] text-slate-500">Transferable & direct</div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">{atsAnalysis.scoreDisclaimer}</p>
        </div>
      </section>

      {/* Honest <75% Explanation & Candidate Questions */}
      {finalScore < 75 &&
        (atsAnalysis.belowTargetExplanation ||
          (atsAnalysis.questionsForCandidate?.length ?? 0) > 0) && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-3 text-xs">
            <div className="flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Why Score Is Currently Below 75% (Truthfulness Guarantee)
                </h2>
                {atsAnalysis.belowTargetExplanation && (
                  <p className="text-slate-700 leading-relaxed">
                    {atsAnalysis.belowTargetExplanation}
                  </p>
                )}
                {atsAnalysis.questionsForCandidate &&
                  atsAnalysis.questionsForCandidate.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-800 mb-1">
                        Questions for Candidate Before Adding Missing Details:
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-slate-700">
                        {atsAnalysis.questionsForCandidate.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          </section>
        )}

      {/* 6-Category Weighted Scoring Breakdown Table */}
      {atsAnalysis.categoryBreakdown && atsAnalysis.categoryBreakdown.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Weighted ATS Compatibility Breakdown (Total = 100%)
            </h2>
            <span className="text-xs text-slate-500">Original vs. Tailored</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-600">
                  <th className="py-2.5 px-6">Evaluation Category</th>
                  <th className="py-2.5 px-4 text-right">Weight</th>
                  <th className="py-2.5 px-4 text-right">Original</th>
                  <th className="py-2.5 px-4 text-right">Tailored</th>
                  <th className="py-2.5 px-4 text-right">Change</th>
                  <th className="py-2.5 px-6">Assessment Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {atsAnalysis.categoryBreakdown.map((row, idx) => {
                  const delta = row.tailoredScore - row.originalScore;
                  return (
                    <tr key={idx}>
                      <td className="py-3 px-6 font-medium text-slate-900">{row.category}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {row.weight}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                        {row.originalScore}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {row.tailoredScore}%
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono tabular-nums font-medium ${
                          delta > 0
                            ? 'text-emerald-700'
                            : delta < 0
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {delta > 0 ? `+${delta}%` : `${delta}%`}
                      </td>
                      <td className="py-3 px-6 text-slate-600 leading-relaxed">{row.notes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Missing Mandatory vs. Preferred Skills + Formatting Issues */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900 tabular-nums">
            Missing Mandatory Skills ({atsAnalysis.missingMandatorySkills?.length ?? 0})
          </h2>
          {!atsAnalysis.missingMandatorySkills ||
          atsAnalysis.missingMandatorySkills.length === 0 ? (
            <p className="text-xs text-emerald-700">No mandatory skills missing.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-700">
              {atsAnalysis.missingMandatorySkills.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900 tabular-nums">
            Missing Preferred Skills ({atsAnalysis.missingPreferredSkills?.length ?? 0})
          </h2>
          {!atsAnalysis.missingPreferredSkills ||
          atsAnalysis.missingPreferredSkills.length === 0 ? (
            <p className="text-xs text-slate-500">None flagged.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-700">
              {atsAnalysis.missingPreferredSkills.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900 tabular-nums">
            ATS Formatting Issues ({atsAnalysis.formattingIssues?.length ?? 0})
          </h2>
          {!atsAnalysis.formattingIssues || atsAnalysis.formattingIssues.length === 0 ? (
            <p className="text-xs text-emerald-700">
              Clean single-column ATS formatting verified.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-700">
              {atsAnalysis.formattingIssues.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* What Changed & Why + Proactive Recommendations */}
      {((atsAnalysis.changesSummary && atsAnalysis.changesSummary.length > 0) ||
        (atsAnalysis.improvementRecommendations &&
          atsAnalysis.improvementRecommendations.length > 0)) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {atsAnalysis.changesSummary && atsAnalysis.changesSummary.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                What Changed & Why
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {atsAnalysis.changesSummary.map((item, i) => (
                  <div key={i} className="py-2.5 space-y-0.5">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span>{item.section}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-normal text-slate-700">{item.change}</span>
                    </div>
                    <p className="text-slate-500">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {atsAnalysis.improvementRecommendations &&
            atsAnalysis.improvementRecommendations.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Proactive Optimization Recommendations
                </h2>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700 leading-relaxed">
                  {atsAnalysis.improvementRecommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
                {atsAnalysis.autoImprovementNotes &&
                  atsAnalysis.autoImprovementNotes.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-1">
                      <div className="text-xs font-semibold text-blue-700">
                        Automatic & Manual Optimization Log:
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        {atsAnalysis.autoImprovementNotes.map((note, i) => (
                          <li key={i}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}
        </section>
      )}

      {/* Keyword Matrix Summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 tabular-nums">
            Matched Keywords ({atsAnalysis.matchedKeywords.length})
          </h2>
          {atsAnalysis.matchedKeywords.length === 0 ? (
            <p className="text-xs text-slate-500">No direct keyword matches recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-700">
              {atsAnalysis.matchedKeywords.map((kw, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{kw}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 tabular-nums">
            Partially Matched ({atsAnalysis.partiallyMatchedKeywords.length})
          </h2>
          {atsAnalysis.partiallyMatchedKeywords.length === 0 ? (
            <p className="text-xs text-slate-500">None detected.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-700">
              {atsAnalysis.partiallyMatchedKeywords.map((kw, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-amber-600 font-mono">~</span>
                  <span>{kw}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 tabular-nums">
            Missing / Unverified Keywords ({atsAnalysis.missingKeywords.length})
          </h2>
          {atsAnalysis.missingKeywords.length === 0 ? (
            <p className="text-xs text-slate-500">All major JD keywords are covered.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-700">
              {atsAnalysis.missingKeywords.map((kw, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{kw}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ATS Keyword Explainer */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>ATS Keyword Explainer</span>
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl">
              Understand why each keyword matters for{' '}
              <span className="font-medium text-slate-900">{current.jobTitle}</span> and how to
              incorporate missing or partial terms truthfully—only when backed by your actual
              experience.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateExplanations()}
            disabled={explaining}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>
              {explaining
                ? 'Analyzing Keywords...'
                : explanations.length > 0
                  ? 'Refresh Explanations'
                  : 'Generate Keyword Explanations'}
            </span>
          </button>
        </div>

        {explanations.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-6 text-center space-y-2.5">
            <p className="text-sm font-medium text-slate-900">
              Detailed keyword explanations have not been generated for this version yet
            </p>
            <p className="text-xs text-slate-600 max-w-lg mx-auto">
              Click Generate Keyword Explanations to have Gemini analyze every matched, partially
              matched, and missing keyword in the context of this job description.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'all', label: `All (${explanations.length})` },
                    {
                      id: 'matched',
                      label: `Matched (${explanations.filter((e) => e.category === 'matched').length})`,
                    },
                    {
                      id: 'partial',
                      label: `Partial (${explanations.filter((e) => e.category === 'partial').length})`,
                    },
                    {
                      id: 'missing',
                      label: `Missing (${explanations.filter((e) => e.category === 'missing').length})`,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setExplainerCategory(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      explainerCategory === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={keywordQuery}
                  onChange={(e) => setKeywordQuery(e.target.value)}
                  placeholder="Filter keywords..."
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {filteredExplanations.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No keywords match your current filter.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {filteredExplanations.map((item, idx) => {
                  const statusLabel =
                    item.category === 'matched'
                      ? 'Matched'
                      : item.category === 'partial'
                        ? 'Partially Matched'
                        : 'Missing from Master Resume';
                  const statusColor =
                    item.category === 'matched'
                      ? 'text-emerald-700'
                      : item.category === 'partial'
                        ? 'text-amber-700'
                        : 'text-slate-600';

                  return (
                    <div key={`${item.keyword}-${idx}`} className="p-4 space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {item.keyword}
                        </span>
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="font-medium text-slate-500 mb-0.5">
                            Significance in Job Description
                          </div>
                          <p className="text-slate-700 leading-relaxed">{item.significance}</p>
                        </div>
                        <div>
                          <div className="font-medium text-slate-500 mb-0.5">
                            {item.category === 'matched'
                              ? 'Current Resume Coverage'
                              : 'Truthful Incorporation Guidance'}
                          </div>
                          <p className="text-slate-700 leading-relaxed">{item.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Experience & Transferable Skills */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900">Relevant Experience</h2>
          <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700 leading-relaxed">
            {atsAnalysis.relevantExperienceHighlights.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900">Transferable Skills</h2>
          <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700 leading-relaxed">
            {atsAnalysis.transferableSkills.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Skills Requiring Further Verification
          </h2>
          {atsAnalysis.skillsRequiringVerification.length === 0 ? (
            <p className="text-xs text-slate-500">None flagged.</p>
          ) : (
            <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-700 leading-relaxed">
              {atsAnalysis.skillsRequiringVerification.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* JD Analysis Summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Extracted Job Description Intelligence
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs border-b border-slate-100 pb-4">
          <div>
            <span className="text-slate-500 block">Department / Seniority</span>
            <span className="font-medium text-slate-900">
              {[jdAnalysis.department, jdAnalysis.seniority].filter(Boolean).join(' · ') ||
                'General'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Industry</span>
            <span className="font-medium text-slate-900">{jdAnalysis.industry || 'General'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Experience Required</span>
            <span className="font-medium text-slate-900">
              {jdAnalysis.requiredExperience || 'Not specified'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">ERP / Software</span>
            <span className="font-medium text-slate-900">
              {jdAnalysis.softwareAndErp.join(', ') || 'None specified'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Procurement Categories</span>
            <span className="font-medium text-slate-900">
              {jdAnalysis.procurementCategories.join(', ') || 'General / Non-procurement'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-semibold text-slate-800 block mb-1">
              Mandatory Requirements
            </span>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              {jdAnalysis.mandatoryRequirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="font-semibold text-slate-800 block mb-1">
              Purchasing & Core Processes
            </span>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              {jdAnalysis.purchasingProcesses.map((proc, i) => (
                <li key={i}>{proc}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Factual Verification & Independent AI Reviewer */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Factual Consistency Verification</span>
            </h2>
            <span
              className={`text-xs font-semibold ${
                factualVerification.passed ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {factualVerification.passed ? 'Verified' : 'Warnings / Errors'}
            </span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {immutableChecks.map((item) => (
              <div key={item.label} className="py-2 flex items-center justify-between">
                <span className="text-slate-700">{item.label}</span>
                <span
                  className={item.ok ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}
                >
                  {item.ok ? 'Unchanged' : 'Mismatch'}
                </span>
              </div>
            ))}
          </div>
          {factualVerification.violations.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1 text-xs text-amber-800">
              {factualVerification.violations.map((v, i) => (
                <div key={i}>• {v.message}</div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Independent AI Reviewer Report
            </h2>
            <span className="text-xs font-medium text-slate-600 capitalize">
              {reviewReport.overallQuality.replace('_', ' ')}
            </span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {reviewerCriteria.map((c) => (
              <div key={c.label} className="py-2 flex items-center justify-between">
                <span className="text-slate-700">{c.label}</span>
                <span
                  className={c.passed ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}
                >
                  {c.passed ? 'Pass' : 'Review'}
                </span>
              </div>
            ))}
          </div>
          {reviewReport.correctionsMade.length > 0 && (
            <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
              <div className="font-semibold text-slate-800">Corrections Applied:</div>
              {reviewReport.correctionsMade.map((c, i) => (
                <div key={i}>• {c}</div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
