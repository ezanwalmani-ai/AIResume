import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import {
  apiDownloadExport,
  apiGetMasterResume,
  apiGetMe,
  apiListResumes,
  triggerBlobDownload,
} from './lib/api.ts';
import { normalizeTemplateId } from './lib/templates.ts';
import type {
  GeneratedResumeRecord,
  MasterResumeRecord,
  ResumeTemplateId,
  TemplateCustomization,
  UserSettings,
} from './types/resume.ts';
import { MasterResumeView } from './components/MasterResumeView.tsx';
import { GenerateResumeView } from './components/GenerateResumeView.tsx';
import { AtsAnalysisView } from './components/AtsAnalysisView.tsx';
import { ResumeHistoryView } from './components/ResumeHistoryView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { OnboardingGuide } from './components/OnboardingGuide.tsx';
import { TemplateLibraryView } from './components/TemplateLibraryView.tsx';
import { ProfileDocumentsView } from './components/ProfileDocumentsView.tsx';
import { ApplicationsView } from './components/ApplicationsView.tsx';
import { AdminOverviewView } from './components/AdminOverviewView.tsx';

type NavSection =
  | 'dashboard'
  | 'master'
  | 'profile'
  | 'generate'
  | 'templates'
  | 'ats'
  | 'applications'
  | 'history'
  | 'settings'
  | 'admin';

const BASE_NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'master', label: 'My Master Resume', icon: FileCheck2 },
  { id: 'profile', label: 'Profile & Documents', icon: FolderOpen },
  { id: 'generate', label: 'Generate Resume', icon: Sparkles },
  { id: 'templates', label: 'Resume Templates', icon: LayoutTemplate },
  { id: 'ats', label: 'ATS Analysis', icon: BarChart3 },
  { id: 'applications', label: 'Jobs & Applications', icon: Briefcase },
  { id: 'history', label: 'Resume History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function SignInScreen() {
  const { signInWithGoogle, authError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // authError is captured in context
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="flex items-center justify-between gap-8 px-6 md:px-10 py-4 bg-white border-b border-slate-200">
        <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display">
          ResumeAI
        </span>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={signingIn}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          {signingIn ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-3xl w-full bg-white rounded-xl border border-slate-200 p-8 md:p-12 space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-balance">
              One Master Resume. Any Job Description. Factually Verified Tailored PDFs.
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              Upload your original PDF or DOCX resume once to establish a permanent, locked Master
              Resume. Paste any target job description to tailor summaries, transferable skills, and
              ATS keywords using Google Gemini AI—with strict factual checks and zero invented
              experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-100 pt-6">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                01. Permanent Master Vault
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Structured extraction in PostgreSQL that is never overwritten when creating new
                job versions.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">
                02. Two-Pass Gemini Review
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Independent factual consistency verification locks companies, titles, dates, and
                education.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900">
                03. ATS-Ready PDF & DOCX
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Selectable-text single-column templates with inline editing and automatic naming.
              </p>
            </div>
          </div>

          {authError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {authError}
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {signingIn ? 'Connecting Google Account...' : 'Sign in with Google to Continue'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function DashboardHome({
  masterResume,
  resumes,
  onboardingCollapsed,
  onToggleOnboarding,
  onNavigate,
  onOpenResume,
  onDownloadPdf,
}: {
  masterResume: MasterResumeRecord | null;
  resumes: GeneratedResumeRecord[];
  onboardingCollapsed: boolean;
  onToggleOnboarding: () => void;
  onNavigate: (section: NavSection) => void;
  onOpenResume: (record: GeneratedResumeRecord) => void;
  onDownloadPdf: (record: GeneratedResumeRecord) => void;
}) {
  const avgScore =
    resumes.length > 0
      ? Math.round(
          resumes.reduce((acc, r) => acc + r.atsAnalysis.estimatedAlignmentScore, 0) /
            resumes.length,
        )
      : null;

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workspace Overview</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate a tailored, ATS-friendly resume in three steps without re-uploading your
            original resume.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleOnboarding}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {onboardingCollapsed ? 'Setup Guide' : 'Hide Guide'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate(masterResume ? 'generate' : 'master')}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            {masterResume ? 'Paste Job Description' : 'Upload Master Resume'}
          </button>
        </div>
      </div>

      {/* Interactive Step-by-Step Onboarding Walkthrough */}
      <OnboardingGuide
        masterResume={masterResume}
        generatedCount={resumes.length}
        collapsed={onboardingCollapsed}
        onToggleCollapse={onToggleOnboarding}
        onGoToMaster={() => onNavigate('master')}
        onGoToGenerate={() => onNavigate('generate')}
      />

      {/* Key Workspace Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500">Permanent Master Resume</div>
          <div className="text-lg font-bold text-slate-900">
            {masterResume
              ? masterResume.isApproved
                ? `Approved · v${masterResume.version}`
                : `Draft · v${masterResume.version}`
              : 'Not Uploaded'}
          </div>
          <div className="text-xs text-slate-600">
            {masterResume
              ? `${masterResume.structuredData.employmentHistory.length} roles · ${masterResume.structuredData.technicalSkills.length} skills`
              : 'Upload a PDF or DOCX once to begin.'}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('master')}
            className="pt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            {masterResume ? 'Review Master Resume' : 'Upload Master Resume'}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500">Tailored Versions Saved</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {resumes.length}
          </div>
          <div className="text-xs text-slate-600">
            Stored independently from your Master Resume.
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="pt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Open Resume History
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="text-xs font-medium text-slate-500">
            Average Est. JD Alignment
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
            {avgScore !== null ? `${avgScore}%` : '—'}
          </div>
          <div className="text-xs text-slate-600">
            Content overlap estimate across generated versions.
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ats')}
            className="pt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Inspect ATS Analysis
          </button>
        </div>
      </div>

      {/* 3-Step Workflow Guide */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Fast Tailoring Workflow</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">01. Paste Job Description</div>
            <p className="text-slate-600 leading-relaxed">
              Provide any job description across procurement, operations, engineering, or corporate
              roles.
            </p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">02. Click Generate</div>
            <p className="text-slate-600 leading-relaxed">
              Gemini maps transferable skills, optimizes truthful keywords, and passes an
              independent second-pass factual review.
            </p>
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-slate-900">03. Preview & Download PDF</div>
            <p className="text-slate-600 leading-relaxed">
              Edit text inline, switch templates, and export selectable-text ATS PDFs named
              automatically.
            </p>
          </div>
        </div>
      </section>

      {/* Recent Resumes */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Tailored Resumes</h2>
          {resumes.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          )}
        </div>

        {resumes.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <FileText className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-900">No tailored resumes yet</p>
            <p className="text-xs text-slate-500">
              {masterResume
                ? 'Paste a job description to generate your first tailored PDF.'
                : 'Upload your permanent Master Resume first to unlock instant tailoring.'}
            </p>
            <button
              type="button"
              onClick={() => onNavigate(masterResume ? 'generate' : 'master')}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {masterResume ? 'Generate First Resume' : 'Set Up Master Resume'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                  <th className="py-2.5 px-6">Role & Company</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4 text-right">Est. Alignment</th>
                  <th className="py-2.5 px-4">Verification</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {resumes.slice(0, 5).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-6">
                      <button
                        type="button"
                        onClick={() => onOpenResume(r)}
                        className="font-semibold text-slate-900 hover:text-blue-600 text-left"
                      >
                        {r.jobTitle}
                      </button>
                      <div className="text-slate-500">{r.companyName}</div>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-600">
                      {r.generationMode.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                      {r.atsAnalysis.estimatedAlignmentScore}%
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{r.factualVerification.passed ? 'Verified' : 'Check'}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => onDownloadPdf(r)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
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

function WorkspaceApp() {
  const { user, loading, getToken, logout } = useAuth();
  const [section, setSection] = useState<NavSection>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [masterResume, setMasterResume] = useState<MasterResumeRecord | null>(null);
  const [resumes, setResumes] = useState<GeneratedResumeRecord[]>([]);
  const [activeGeneratedResume, setActiveGeneratedResume] =
    useState<GeneratedResumeRecord | null>(null);
  const [activeAtsResume, setActiveAtsResume] =
    useState<GeneratedResumeRecord | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<{
    templateId: ResumeTemplateId;
    customization: TemplateCustomization | null;
  } | null>(null);
  const [prefillJd, setPrefillJd] = useState<string | undefined>(undefined);

  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [onboardingCollapsed, setOnboardingCollapsed] = useState(false);

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const token = await getToken();
      const [me, master, history] = await Promise.all([
        apiGetMe(token),
        apiGetMasterResume(token),
        apiListResumes(token),
      ]);
      setSettings(me);
      setMasterResume(master);
      setResumes(history);
      if (master?.isApproved && history.length > 0) {
        setOnboardingCollapsed(true);
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Failed to load workspace data.');
    } finally {
      setDataLoading(false);
    }
  }, [user, getToken]);

  useEffect(() => {
    if (user) {
      void loadWorkspaceData();
    }
  }, [user, loadWorkspaceData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-slate-600">
        Loading ResumeAI...
      </div>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

  const navItems = settings?.isAdmin
    ? [...BASE_NAV_ITEMS, { id: 'admin' as NavSection, label: 'Admin Overview', icon: ShieldCheck }]
    : BASE_NAV_ITEMS;

  const currentNavLabel =
    navItems.find((n) => n.id === section)?.label ?? 'Dashboard';

  const handleQuickDownloadPdf = async (record: GeneratedResumeRecord) => {
    try {
      const token = await getToken();
      const { blob, filename } = await apiDownloadExport(token, 'pdf', {
        tailoredResume: record.tailoredResume,
        templateId: record.templateId,
        templateCustomization: record.templateCustomization,
        jobTitle: record.jobTitle,
        companyName: record.companyName,
      });
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'PDF download failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200">
        <div className="h-14 px-5 flex items-center border-b border-slate-200">
          <span className="text-base font-bold tracking-tight text-slate-900 font-display">
            ResumeAI
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  if (item.id === 'generate' && activeGeneratedResume) {
                    // keep active preview if already selected
                  }
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="text-xs">
            <div className="font-medium text-slate-900 truncate">
              {user.displayName || user.email}
            </div>
            <div className="text-slate-500 truncate">{user.email}</div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="text-base font-bold text-slate-900 font-display">
                ResumeAI
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-1 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => void logout()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, 1 primary action on right */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="font-medium text-slate-900">ResumeAI</span>
              <span aria-hidden="true">/</span>
              <span className="truncate">{currentNavLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveGeneratedResume(null);
              setSection('generate');
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            New Tailored Resume
          </button>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {dataError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-4">
              <span>{dataError}</span>
              <button
                type="button"
                onClick={() => void loadWorkspaceData()}
                className="px-3 py-1 text-xs font-semibold border border-red-300 rounded-md hover:bg-red-100 whitespace-nowrap shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {dataLoading && !settings ? (
            <div className="max-w-5xl space-y-4">
              <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              {section === 'dashboard' && (
                <DashboardHome
                  masterResume={masterResume}
                  resumes={resumes}
                  onboardingCollapsed={onboardingCollapsed}
                  onToggleOnboarding={() => setOnboardingCollapsed((v) => !v)}
                  onNavigate={(target) => {
                    if (target === 'generate') setActiveGeneratedResume(null);
                    setSection(target);
                  }}
                  onOpenResume={(rec) => {
                    setActiveGeneratedResume(rec);
                    setSection('generate');
                  }}
                  onDownloadPdf={(rec) => void handleQuickDownloadPdf(rec)}
                />
              )}

              {section === 'master' && (
                <MasterResumeView
                  masterResume={masterResume}
                  onUpdated={(updated) => setMasterResume(updated)}
                  onNavigateGenerate={() => {
                    setActiveGeneratedResume(null);
                    setSection('generate');
                  }}
                />
              )}

              {section === 'profile' && (
                <ProfileDocumentsView
                  masterResume={masterResume}
                  onNavigateMaster={() => setSection('master')}
                />
              )}

              {section === 'generate' && (
                <GenerateResumeView
                  masterResume={masterResume}
                  defaultMode={settings?.defaultMode ?? 'balanced'}
                  defaultTemplate={
                    pendingTemplate?.templateId ??
                    normalizeTemplateId(settings?.defaultTemplate ?? 'classic_professional')
                  }
                  initialCustomization={pendingTemplate?.customization ?? null}
                  initialJobDescription={prefillJd}
                  activeResume={activeGeneratedResume}
                  onGenerated={(created) => {
                    setResumes((prev) => [created, ...prev]);
                    setActiveGeneratedResume(created);
                    setActiveAtsResume(created);
                    setPendingTemplate(null);
                    setPrefillJd(undefined);
                  }}
                  onUpdated={(updated) => {
                    setResumes((prev) =>
                      prev.map((item) => (item.id === updated.id ? updated : item)),
                    );
                    setActiveGeneratedResume(updated);
                    if (activeAtsResume?.id === updated.id) {
                      setActiveAtsResume(updated);
                    }
                  }}
                  onSavedAsNewVersion={(created) => {
                    setResumes((prev) => [created, ...prev]);
                    setActiveGeneratedResume(created);
                    setActiveAtsResume(created);
                  }}
                  onClearActive={() => {
                    setActiveGeneratedResume(null);
                    setPrefillJd(undefined);
                  }}
                  onNavigateMaster={() => setSection('master')}
                  onNavigateAts={(rec) => {
                    setActiveAtsResume(rec);
                    setSection('ats');
                  }}
                  onOpenTemplatesLibrary={() => setSection('templates')}
                  onTrackApplication={() => setSection('applications')}
                />
              )}

              {section === 'templates' && (
                <TemplateLibraryView
                  masterResume={masterResume}
                  activeResume={activeGeneratedResume}
                  defaultTemplate={normalizeTemplateId(
                    settings?.defaultTemplate ?? 'classic_professional',
                  )}
                  onApplyToActiveResume={(updated) => {
                    setResumes((prev) =>
                      prev.map((item) => (item.id === updated.id ? updated : item)),
                    );
                    setActiveGeneratedResume(updated);
                    if (activeAtsResume?.id === updated.id) {
                      setActiveAtsResume(updated);
                    }
                    setSection('generate');
                  }}
                  onSavedAsNewVersion={(created) => {
                    setResumes((prev) => [created, ...prev]);
                    setActiveGeneratedResume(created);
                    setActiveAtsResume(created);
                    setSection('generate');
                  }}
                  onUseForNewResume={(tplId, custom) => {
                    setPendingTemplate({ templateId: tplId, customization: custom });
                    setActiveGeneratedResume(null);
                    setSection('generate');
                  }}
                />
              )}

              {section === 'ats' && (
                <AtsAnalysisView
                  resumes={resumes}
                  selectedResume={activeAtsResume}
                  onSelectResume={(rec) => setActiveAtsResume(rec)}
                  onResumeUpdated={(updated) => {
                    setResumes((prev) =>
                      prev.map((item) => (item.id === updated.id ? updated : item)),
                    );
                    if (activeGeneratedResume?.id === updated.id) {
                      setActiveGeneratedResume(updated);
                    }
                    setActiveAtsResume(updated);
                  }}
                  onOpenEditor={(rec) => {
                    setActiveGeneratedResume(rec);
                    setSection('generate');
                  }}
                />
              )}

              {section === 'applications' && (
                <ApplicationsView
                  resumes={resumes}
                  onGenerateForJob={(jd) => {
                    setPrefillJd(jd);
                    setActiveGeneratedResume(null);
                    setSection('generate');
                  }}
                />
              )}

              {section === 'history' && (
                <ResumeHistoryView
                  resumes={resumes}
                  onSelectResume={(rec) => {
                    setActiveGeneratedResume(rec);
                    setSection('generate');
                  }}
                  onSelectAts={(rec) => {
                    setActiveAtsResume(rec);
                    setSection('ats');
                  }}
                  onDeleted={(id) => {
                    setResumes((prev) => prev.filter((r) => r.id !== id));
                    if (activeGeneratedResume?.id === id) setActiveGeneratedResume(null);
                    if (activeAtsResume?.id === id) setActiveAtsResume(null);
                  }}
                  onNavigateGenerate={() => {
                    setActiveGeneratedResume(null);
                    setSection('generate');
                  }}
                />
              )}

              {section === 'settings' && settings && (
                <SettingsView
                  settings={settings}
                  onSettingsUpdated={(updated) => setSettings(updated)}
                  onMasterDeleted={() => setMasterResume(null)}
                  onHistoryCleared={() => {
                    setResumes([]);
                    setActiveGeneratedResume(null);
                    setActiveAtsResume(null);
                  }}
                />
              )}

              {section === 'admin' && settings?.isAdmin && <AdminOverviewView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceApp />
    </AuthProvider>
  );
}
