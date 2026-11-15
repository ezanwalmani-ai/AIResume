import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiGetAdminOverview } from '../lib/api.ts';
import type { AdminOverviewStats } from '../types/database.ts';

function formatStorageSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function AdminOverviewView() {
  const { getToken } = useAuth();
  const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const stats = await apiGetAdminOverview(token);
      setOverview(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load administrative overview.');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  if (loading && !overview) {
    return (
      <div className="max-w-6xl space-y-4">
        <div className="h-8 w-72 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Admin Database Overview
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Live relational Cloud SQL PostgreSQL metrics, private storage volume, automation runs,
            and recent audit activity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOverview()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {overview && (
        <>
          {/* Aggregate Counts Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              ['Registered Users', overview.totalUsers],
              ['Uploaded Documents', overview.totalUploadedDocuments],
              ['Tailored Resumes', overview.totalGeneratedResumes],
              ['Job Descriptions', overview.totalJobDescriptions],
              ['Discovered Jobs', overview.totalDiscoveredJobs],
              ['Tracked Applications', overview.totalApplications],
              ['Emails Logged', overview.totalEmailsSent],
              ['Resume Templates', overview.totalTemplates],
              ['PostgreSQL Size', formatStorageSize(overview.databaseSizeBytes)],
              ['Private File Storage', formatStorageSize(overview.privateStorageBytes)],
            ].map(([label, val]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-1.5"
              >
                <div className="text-xs font-medium text-slate-500">{label}</div>
                <div className="text-xl font-bold text-slate-900 tabular-nums font-mono">
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Automation Runs */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Latest Automation Runs ({overview.latestAutomationRuns.length})
              </h2>
            </div>
            {overview.latestAutomationRuns.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No automation runs recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                      <th className="py-2.5 px-6">Type</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Scanned</th>
                      <th className="py-2.5 px-4 text-right">Matched</th>
                      <th className="py-2.5 px-4">Summary</th>
                      <th className="py-2.5 px-6 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {overview.latestAutomationRuns.map((run) => (
                      <tr key={run.id}>
                        <td className="py-3 px-6 font-medium text-slate-900">
                          {run.automationType}
                        </td>
                        <td className="py-3 px-4 capitalize text-emerald-700 font-medium">
                          {run.executionStatus}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {run.jobsDiscovered}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
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

          {/* Recent Audit Logs */}
          <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 text-sm font-semibold text-slate-900">
              Recent Security & Mutation Audit Logs ({overview.recentAuditLogs.length})
            </div>
            {overview.recentAuditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No audit events recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/60">
                      <th className="py-2.5 px-6">Action</th>
                      <th className="py-2.5 px-4">Entity</th>
                      <th className="py-2.5 px-4">User ID</th>
                      <th className="py-2.5 px-6 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {overview.recentAuditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-6 font-mono font-medium text-slate-900">
                          {log.actionType}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {log.entityType} ({log.entityId})
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                          #{log.userId}
                        </td>
                        <td className="py-2.5 px-6 text-right tabular-nums text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
