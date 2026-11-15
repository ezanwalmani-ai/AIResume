import { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Loader2,
  Mail,
  Play,
  Plus,
  Save,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  apiCreateApplication,
  apiCreateJob,
  apiCreateRecruiter,
  apiDeleteApplication,
  apiDeleteRecruiter,
  apiGetJobPreferences,
  apiListApplications,
  apiListAutomationRuns,
  apiListEmails,
  apiListJobs,
  apiListRecruiters,
  apiRecordApplicationEmail,
  apiTriggerAutomationRun,
  apiUpdateApplication,
  apiUpdateJobPreferences,
} from '../lib/api.ts';
import {
  APPLICATION_STATUSES,
  type ApplicationRecord,
  type ApplicationStatus,
  type AutomationRunRecord,
  type EmailMessageRecord,
  type JobListingRecord,
  type JobPreferencesRecord,
  type RecruiterRecord,
} from '../types/database.ts';
import type { GeneratedResumeRecord } from '../types/resume.ts';

interface ApplicationsViewProps {
  resumes: GeneratedResumeRecord[];
  onGenerateForJob?: (jobDescription: string) => void;
}

type SubTab = 'applications' | 'jobs' | 'recruiters' | 'automation';

export function ApplicationsView({ resumes, onGenerateForJob }: ApplicationsViewProps) {
  const { getToken, user } = useAuth();
  const [tab, setTab] = useState<SubTab>('applications');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [jobs, setJobs] = useState<JobListingRecord[]>([]);
  const [recruiters, setRecruiters] = useState<RecruiterRecord[]>([]);
  const [emails, setEmails] = useState<EmailMessageRecord[]>([]);
  const [preferences, setPreferences] = useState<JobPreferencesRecord | null>(null);
  const [automationRuns, setAutomationRuns] = useState<AutomationRunRecord[]>([]);

  // New application form
  const [appCompany, setAppCompany] = useState('');
  const [appTitle, setAppTitle] = useState('');
  const [appMethod, setAppMethod] = useState('portal');
  const [appResumeId, setAppResumeId] = useState<string>('');
  const [appUrl, setAppUrl] = useState('');
  const [appNotes, setAppNotes] = useState('');
  const [creatingApp, setCreatingApp] = useState(false);

  // Email log modal inline state
  const [emailAppId, setEmailAppId] = useState<string | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [loggingEmail, setLoggingEmail] = useState(false);

  // New job form
  const [jobCompany, setJobCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [jobSalary, setJobSalary] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [savingJob, setSavingJob] = useState(false);

  // New recruiter form
  const [recCompany, setRecCompany] = useState('');
  const [recName, setRecName] = useState('');
  const [recDesignation, setRecDesignation] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recLinkedin, setRecLinkedin] = useState('');
  const [recVerification, setRecVerification] = useState<'verified' | 'unverified'>('unverified');
  const [savingRec, setSavingRec] = useState(false);

  // Preferences form state
  const [targetRolesText, setTargetRolesText] = useState('');
  const [prefLocationsText, setPrefLocationsText] = useState('');
  const [excludedCompaniesText, setExcludedCompaniesText] = useState('');
  const [minAtsScore, setMinAtsScore] = useState(75);
  const [dailyEmailLimit, setDailyEmailLimit] = useState(5);
  const [dailySearchEnabled, setDailySearchEnabled] = useState(true);
  const [dailySearchTime, setDailySearchTime] = useState('09:00');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [runningAuto, setRunningAuto] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [apps, jobList, recList, emailList, prefs, runs] = await Promise.all([
        apiListApplications(token),
        apiListJobs(token),
        apiListRecruiters(token),
        apiListEmails(token),
        apiGetJobPreferences(token),
        apiListAutomationRuns(token),
      ]);
      setApplications(apps);
      setJobs(jobList);
      setRecruiters(recList);
      setEmails(emailList);
      setPreferences(prefs);
      setAutomationRuns(runs);
      setTargetRolesText(prefs.targetRoles.join(', '));
      setPrefLocationsText(prefs.preferredLocations.join(', '));
      setExcludedCompaniesText(prefs.excludedCompanies.join(', '));
      setMinAtsScore(prefs.minimumAtsScore);
      setDailyEmailLimit(prefs.dailyEmailLimit);
      setDailySearchEnabled(prefs.dailySearchEnabled);
      setDailySearchTime(prefs.dailySearchTime || '09:00');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application workspace.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateApp = async () => {
    if (!appCompany.trim() || !appTitle.trim()) {
      setError('Company name and job title are required.');
      return;
    }
    setCreatingApp(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      const created = await apiCreateApplication(token, {
        companyName: appCompany.trim(),
        jobTitle: appTitle.trim(),
        applicationMethod: appMethod,
        generatedResumeId: appResumeId ? Number(appResumeId) : null,
        applicationUrl: appUrl.trim(),
        notes: appNotes.trim(),
        applicationStatus: appResumeId ? 'Resume Generated' : 'Shortlisted',
      });
      setApplications((prev) => [created, ...prev]);
      setAppCompany('');
      setAppTitle('');
      setAppUrl('');
      setAppNotes('');
      setNotice(`Application tracked for ${created.jobTitle} at ${created.companyName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create application.');
    } finally {
      setCreatingApp(false);
    }
  };

  const handleStatusChange = async (appId: string, nextStatus: ApplicationStatus) => {
    setError(null);
    try {
      const token = await getToken();
      const updated = await apiUpdateApplication(token, appId, {
        applicationStatus: nextStatus,
      });
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleDeleteApp = async (appId: string) => {
    setError(null);
    try {
      const token = await getToken();
      await apiDeleteApplication(token, appId);
      setApplications((prev) => prev.filter((a) => a.id !== appId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application.');
    }
  };

  const handleLogEmail = async () => {
    if (!emailAppId || !emailRecipient.trim() || !emailSubject.trim()) {
      setError('Recipient email and subject are required.');
      return;
    }
    setLoggingEmail(true);
    setError(null);
    try {
      const token = await getToken();
      const logged = await apiRecordApplicationEmail(token, emailAppId, {
        senderEmail: user?.email || '',
        recipientEmail: emailRecipient.trim(),
        subject: emailSubject.trim(),
        emailProvider: 'gmail',
        messageType: 'outbound',
        messageStatus: 'sent',
        markApplicationSent: true,
      });
      setEmails((prev) => [logged, ...prev]);
      setApplications((prev) =>
        prev.map((a) =>
          a.id === emailAppId
            ? {
                ...a,
                applicationStatus: 'Email Sent',
                recipientEmail: logged.recipientEmail,
                emailSubject: logged.subject,
                sentAt: logged.sentAt,
              }
            : a,
        ),
      );
      setEmailAppId(null);
      setEmailRecipient('');
      setEmailSubject('');
      setNotice('Confirmed email activity logged and application marked Email Sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record email.');
    } finally {
      setLoggingEmail(false);
    }
  };

  const handleCreateJob = async () => {
    if (!jobCompany.trim() || !jobTitle.trim()) {
      setError('Company name and job title are required.');
      return;
    }
    setSavingJob(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      const saved = await apiCreateJob(token, {
        companyName: jobCompany.trim(),
        jobTitle: jobTitle.trim(),
        location: jobLocation.trim(),
        jobUrl: jobUrl.trim(),
        salaryRange: jobSalary.trim(),
        jobDescription: jobDesc.trim(),
      });
      setJobs((prev) => {
        const filtered = prev.filter((j) => j.id !== saved.id);
        return [saved, ...filtered];
      });
      setJobCompany('');
      setJobTitle('');
      setJobLocation('');
      setJobUrl('');
      setJobSalary('');
      setJobDesc('');
      setNotice(`Job "${saved.jobTitle}" at ${saved.companyName} saved (deduplicated).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save job.');
    } finally {
      setSavingJob(false);
    }
  };

  const handleCreateRecruiter = async () => {
    if (!recCompany.trim() || !recName.trim()) {
      setError('Company name and recruiter name are required.');
      return;
    }
    setSavingRec(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      const created = await apiCreateRecruiter(token, {
        companyName: recCompany.trim(),
        recruiterName: recName.trim(),
        designation: recDesignation.trim(),
        professionalEmail: recEmail.trim(),
        linkedinUrl: recLinkedin.trim(),
        contactSource: 'user_provided',
        verificationStatus: recVerification,
      });
      setRecruiters((prev) => [created, ...prev]);
      setRecCompany('');
      setRecName('');
      setRecDesignation('');
      setRecEmail('');
      setRecLinkedin('');
      setNotice(`Recruiter contact "${created.recruiterName}" saved.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recruiter contact.');
    } finally {
      setSavingRec(false);
    }
  };

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      const updated = await apiUpdateJobPreferences(token, {
        targetRoles: targetRolesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredLocations: prefLocationsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        excludedCompanies: excludedCompaniesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        minimumAtsScore: Number(minAtsScore),
        dailyEmailLimit: Number(dailyEmailLimit),
        dailySearchEnabled,
        dailySearchTime,
      });
      setPreferences(updated);
      setNotice('Job automation preferences saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleTriggerRun = async () => {
    setRunningAuto(true);
    setError(null);
    setNotice(null);
    try {
      const token = await getToken();
      const run = await apiTriggerAutomationRun(token);
      setAutomationRuns((prev) => [run, ...prev]);
      setNotice(run.executionSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute automation cycle.');
    } finally {
      setRunningAuto(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl space-y-4">
        <div className="h-8 w-72 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Jobs, Applications & Automation
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Track job applications, discovered roles, verified recruiter contacts, email activity,
            and matching preferences in PostgreSQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
          {(
            [
              ['applications', `Applications (${applications.length})`],
              ['jobs', `Discovered Jobs (${jobs.length})`],
              ['recruiters', `Recruiters & Emails (${recruiters.length})`],
              ['automation', 'Automation & Preferences'],
            ] as Array<[SubTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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

      {/* TAB 1: APPLICATIONS */}
      {tab === 'applications' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Track New Application</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <input
                type="text"
                value={appCompany}
                onChange={(e) => setAppCompany(e.target.value)}
                placeholder="Company Name *"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="text"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                placeholder="Job Title *"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <select
                value={appMethod}
                onChange={(e) => setAppMethod(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="portal">Job Portal</option>
                <option value="email">Direct Email</option>
                <option value="linkedin">LinkedIn Easy Apply</option>
                <option value="referral">Referral</option>
              </select>
              <select
                value={appResumeId}
                onChange={(e) => setAppResumeId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Attach Tailored Resume (optional)</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    v{r.version}: {r.jobTitle} — {r.companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <input
                type="url"
                value={appUrl}
                onChange={(e) => setAppUrl(e.target.value)}
                placeholder="Application / Job Posting URL (optional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="text"
                value={appNotes}
                onChange={(e) => setAppNotes(e.target.value)}
                placeholder="Notes or follow-up reminder"
                className="md:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={creatingApp}
                onClick={() => void handleCreateApp()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creatingApp ? 'Saving...' : 'Add Application'}</span>
              </button>
            </div>
          </section>

          {emailAppId && (
            <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900">
                  Log Confirmed Outbound Email Activity
                </h3>
                <button
                  type="button"
                  onClick={() => setEmailAppId(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="Recipient HR / Recruiter Email *"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email Subject *"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={loggingEmail}
                  onClick={() => void handleLogEmail()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>{loggingEmail ? 'Logging...' : 'Confirm & Record Sent Email'}</span>
                </button>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {applications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Briefcase className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-900">No applications tracked yet</p>
                <p className="text-xs text-slate-500">
                  Create an application above or click "Track Application" on any generated resume.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                      <th className="py-2.5 px-6">Role & Company</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Updated</th>
                      <th className="py-2.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-6">
                          <div className="font-semibold text-slate-900">{app.jobTitle}</div>
                          <div className="text-slate-500">{app.companyName}</div>
                          {app.notes && (
                            <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                              {app.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 capitalize text-slate-600">
                          {app.applicationMethod}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={app.applicationStatus}
                            onChange={(e) =>
                              void handleStatusChange(app.id, e.target.value as ApplicationStatus)
                            }
                            aria-label={`Status for ${app.jobTitle}`}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-800"
                          >
                            {APPLICATION_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 tabular-nums text-slate-500">
                          {new Date(app.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEmailAppId(app.id);
                                setEmailRecipient(app.recipientEmail || '');
                                setEmailSubject(
                                  app.emailSubject || `Application for ${app.jobTitle}`,
                                );
                              }}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Log Email</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteApp(app.id)}
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
      )}

      {/* TAB 2: DISCOVERED JOBS */}
      {tab === 'jobs' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Save Job Listing (Deduplicated by URL / Company & Title)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={jobCompany}
                onChange={(e) => setJobCompany(e.target.value)}
                placeholder="Company Name *"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Job Title *"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="text"
                value={jobLocation}
                onChange={(e) => setJobLocation(e.target.value)}
                placeholder="Location"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="Job URL (dedupe key)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="text"
                value={jobSalary}
                onChange={(e) => setJobSalary(e.target.value)}
                placeholder="Salary Range (optional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <textarea
              rows={3}
              value={jobDesc}
              onChange={(e) => setJobDesc(e.target.value)}
              placeholder="Paste job description text..."
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingJob}
                onClick={() => void handleCreateJob()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingJob ? 'Saving...' : 'Save Job Listing'}</span>
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No discovered jobs saved yet.
              </div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 max-w-2xl">
                    <div className="text-sm font-semibold text-slate-900">
                      {job.jobTitle} — {job.companyName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[job.location, job.salaryRange, job.source].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {onGenerateForJob && job.jobDescription.trim().length >= 30 && (
                      <button
                        type="button"
                        onClick={() => onGenerateForJob(job.jobDescription)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      >
                        Tailor Resume
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAppCompany(job.companyName);
                        setAppTitle(job.jobTitle);
                        setAppUrl(job.jobUrl || '');
                        setTab('applications');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      Track Application
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {/* TAB 3: VERIFIED RECRUITERS & EMAIL LOGS */}
      {tab === 'recruiters' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Add Recruiter Contact</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Store only verified or user-provided recruiter contacts. Unverified contacts are
                flagged clearly.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={recCompany}
                onChange={(e) => setRecCompany(e.target.value)}
                placeholder="Company Name *"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="text"
                value={recName}
                onChange={(e) => setRecName(e.target.value)}
                placeholder="Recruiter Name *"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="text"
                value={recDesignation}
                onChange={(e) => setRecDesignation(e.target.value)}
                placeholder="Designation (e.g., Talent Lead)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="email"
                value={recEmail}
                onChange={(e) => setRecEmail(e.target.value)}
                placeholder="Official Email"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <input
                type="url"
                value={recLinkedin}
                onChange={(e) => setRecLinkedin(e.target.value)}
                placeholder="LinkedIn Profile URL"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
              <select
                value={recVerification}
                onChange={(e) => setRecVerification(e.target.value as 'verified' | 'unverified')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="unverified">Unverified (User Provided)</option>
                <option value="verified">Verified</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingRec}
                onClick={() => void handleCreateRecruiter()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{savingRec ? 'Saving...' : 'Save Recruiter'}</span>
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Saved Recruiters ({recruiters.length})
            </div>
            {recruiters.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No recruiter contacts saved yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recruiters.map((rec) => (
                  <div
                    key={rec.id}
                    className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        {rec.recruiterName} · {rec.companyName}
                      </div>
                      <div className="text-slate-500">
                        {[rec.designation, rec.professionalEmail, rec.verificationStatus]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const token = await getToken();
                        await apiDeleteRecruiter(token, rec.id);
                        setRecruiters((prev) => prev.filter((r) => r.id !== rec.id));
                      }}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Confirmed Email Activity Log ({emails.length})
            </div>
            {emails.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No outbound or inbound email logs recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {emails.map((em) => (
                  <div
                    key={em.id}
                    className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{em.subject}</div>
                      <div className="text-slate-500">
                        To: {em.recipientEmail} · Provider: {em.emailProvider} · Status:{' '}
                        {em.messageStatus}
                      </div>
                    </div>
                    <span className="tabular-nums text-slate-500">
                      {new Date(em.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 4: AUTOMATION & PREFERENCES */}
      {tab === 'automation' && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Job Matching & Automation Preferences
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure minimum ATS alignment thresholds, target roles, and daily matching
                  limits.
                </p>
              </div>
              <button
                type="button"
                disabled={runningAuto}
                onClick={() => void handleTriggerRun()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {runningAuto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>{runningAuto ? 'Running Match...' : 'Run Daily Match Now'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  Target Roles (comma-separated)
                </label>
                <input
                  type="text"
                  value={targetRolesText}
                  onChange={(e) => setTargetRolesText(e.target.value)}
                  placeholder="Procurement Specialist, Supply Chain Buyer"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  Preferred Locations (comma-separated)
                </label>
                <input
                  type="text"
                  value={prefLocationsText}
                  onChange={(e) => setPrefLocationsText(e.target.value)}
                  placeholder="Dubai, Abu Dhabi"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  Minimum ATS Score Threshold (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={minAtsScore}
                  onChange={(e) => setMinAtsScore(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  Daily Outreach Email Limit
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={dailyEmailLimit}
                  onChange={(e) => setDailyEmailLimit(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 mb-1">
                  Excluded Companies (comma-separated)
                </label>
                <input
                  type="text"
                  value={excludedCompaniesText}
                  onChange={(e) => setExcludedCompaniesText(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="flex items-center gap-6 pt-4">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dailySearchEnabled}
                    onChange={(e) => setDailySearchEnabled(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Daily Job Matching Enabled</span>
                </label>
                <input
                  type="time"
                  value={dailySearchTime}
                  onChange={(e) => setDailySearchTime(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            {preferences && (
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={savingPrefs}
                  onClick={() => void handleSavePrefs()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingPrefs ? 'Saving...' : 'Save Automation Preferences'}</span>
                </button>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Automation Run History ({automationRuns.length})
            </div>
            {automationRuns.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No automation runs executed yet. Click "Run Daily Match Now" to scan saved jobs.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                      <th className="py-2.5 px-6">Type</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Jobs Scanned</th>
                      <th className="py-2.5 px-4 text-right">Matched</th>
                      <th className="py-2.5 px-4">Summary</th>
                      <th className="py-2.5 px-6 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {automationRuns.map((run) => (
                      <tr key={run.id}>
                        <td className="py-3 px-6 font-medium text-slate-900">
                          {run.automationType}
                        </td>
                        <td className="py-3 px-4 capitalize text-emerald-700 font-medium">
                          {run.executionStatus}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-mono">
                          {run.jobsDiscovered}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums font-mono">
                          {run.jobsMatched}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{run.executionSummary}</td>
                        <td className="py-3 px-6 text-right tabular-nums text-slate-500">
                          {new Date(run.startedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
