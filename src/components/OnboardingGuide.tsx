import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  FileText,
  Layers,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { MasterResumeRecord } from '../types/resume.ts';

interface OnboardingGuideProps {
  masterResume: MasterResumeRecord | null;
  generatedCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onGoToMaster: () => void;
  onGoToGenerate: () => void;
}

export function OnboardingGuide({
  masterResume,
  generatedCount,
  collapsed,
  onToggleCollapse,
  onGoToMaster,
  onGoToGenerate,
}: OnboardingGuideProps) {
  const initialStep = !masterResume || !masterResume.isApproved ? 0 : generatedCount === 0 ? 1 : 2;
  const [activeStep, setActiveStep] = useState<number>(initialStep);

  const step1Done = Boolean(masterResume?.isApproved);
  const step2Done = generatedCount > 0;
  const completedSteps = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step2Done ? 1 : 0);

  const steps = [
    {
      number: '01',
      title: 'Upload & Lock Master Resume',
      done: step1Done,
      icon: FileCheck2,
      summary:
        'Import your original PDF or DOCX resume once. Gemini structures your experience into a permanent vault that never changes when you tailor for new jobs.',
      highlights: [
        'Supports PDF, DOCX, or pasted resume text up to 10 MB.',
        'Review and correct extracted dates, companies, ERP tools, and bullet points.',
        'Once approved, your full name, contacts, companies, titles, and dates act as immutable factual anchors.',
      ],
      ctaLabel: step1Done ? 'Review Master Resume' : 'Upload Master Resume',
      onCta: onGoToMaster,
    },
    {
      number: '02',
      title: 'Paste Any Job Description',
      done: step2Done,
      icon: FileText,
      summary:
        'Paste the complete target job posting—including responsibilities, qualifications, and software requirements—without re-uploading your resume.',
      highlights: [
        'Gemini identifies the industry, mandatory criteria, ERP systems, procurement categories, and ATS keywords.',
        'Transferable workflows (such as RFQ management, vendor negotiation, or SAP MM) are matched truthfully to your real background.',
        'Unsupported requirements are isolated and never fabricated on your resume.',
      ],
      ctaLabel: step1Done ? 'Paste Job Description' : 'Complete Step 01 First',
      onCta: step1Done ? onGoToGenerate : onGoToMaster,
    },
    {
      number: '03',
      title: 'Choose Generation Mode & Export',
      done: step2Done,
      icon: Layers,
      summary:
        'Select how aggressively Gemini tailors phrasing, verify factual consistency, refine in the real-time split-pane preview, and export ATS-ready PDFs.',
      highlights: [
        'Balanced Resume: Natural executive balance across all verified roles and transferable strengths.',
        'Maximum JD Alignment: Leads with the highest-relevance responsibilities and supported JD terminology.',
        'Conservative Resume: Minimal wording changes focused on grammar, clarity, and clean ATS formatting.',
      ],
      ctaLabel: step1Done ? 'Open Tailor Studio' : 'Upload Master Resume',
      onCta: step1Done ? onGoToGenerate : onGoToMaster,
    },
  ];

  const current = steps[activeStep];

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/50">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Getting Started with ResumeAI
            </h2>
            <span className="text-xs text-slate-500 tabular-nums font-mono">
              {completedSteps}/3 completed
            </span>
          </div>
          <p className="text-xs text-slate-600">
            One Permanent Master Resume + Any Job Description + Gemini AI = Tailored ATS PDFs in
            seconds.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <span>{collapsed ? 'Show Guide' : 'Minimize Guide'}</span>
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-6 space-y-6">
          {/* Stepper Tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;
              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    isActive
                      ? 'border-blue-600 bg-blue-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-slate-500">
                      Step {step.number}
                    </span>
                    {step.done ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                  <div className="mt-1.5 text-sm font-semibold text-slate-900">
                    {step.title}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Detail Panel */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Step {current.number} Guide</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">{current.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{current.summary}</p>
              <ul className="space-y-2 pt-1">
                {current.highlights.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={current.onCta}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{current.ctaLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {activeStep < steps.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveStep((s) => s + 1)}
                    className="px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
                  >
                    Next Step
                  </button>
                )}
              </div>
            </div>

            {/* Contextual Visual Reference Box */}
            <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
              {activeStep === 0 && (
                <>
                  <div className="text-xs font-semibold text-slate-900">
                    What Gets Locked in Your Master Resume
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-1.5 flex justify-between">
                      <span className="text-slate-600">Full Name & Contacts</span>
                      <span className="font-medium text-slate-900">Immutable</span>
                    </div>
                    <div className="py-1.5 flex justify-between">
                      <span className="text-slate-600">Companies & Job Titles</span>
                      <span className="font-medium text-slate-900">Immutable</span>
                    </div>
                    <div className="py-1.5 flex justify-between">
                      <span className="text-slate-600">Joining & Leaving Dates</span>
                      <span className="font-medium text-slate-900">Immutable</span>
                    </div>
                    <div className="py-1.5 flex justify-between">
                      <span className="text-slate-600">Education & Certifications</span>
                      <span className="font-medium text-slate-900">Immutable</span>
                    </div>
                  </div>
                </>
              )}

              {activeStep === 1 && (
                <>
                  <div className="text-xs font-semibold text-slate-900">
                    Example Job Description Input
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 leading-relaxed font-mono">
                    Role: Purchase Executive – Raw Material
                    <br />
                    Requirements: Manage RFQ floating, vendor evaluation, price negotiation, PO
                    release in SAP MM, GRN follow-up, and invoice verification...
                  </div>
                  <p className="text-xs text-slate-500">
                    Tip: Include the full posting text rather than just the job title so Gemini can
                    map exact processes and ERP keywords.
                  </p>
                </>
              )}

              {activeStep === 2 && (
                <>
                  <div className="text-xs font-semibold text-slate-900">
                    Generation Mode Comparison
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2">
                      <div className="font-semibold text-slate-900">Balanced Resume</div>
                      <div className="text-slate-600">
                        Best for general applications requiring well-rounded career framing.
                      </div>
                    </div>
                    <div className="py-2">
                      <div className="font-semibold text-slate-900">Maximum JD Alignment</div>
                      <div className="text-slate-600">
                        Best when pivoting industries using transferable procurement or ops skills.
                      </div>
                    </div>
                    <div className="py-2">
                      <div className="font-semibold text-slate-900">Conservative Resume</div>
                      <div className="text-slate-600">
                        Best when you want wording kept closest to your original resume.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
