import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  apiDeleteAccountData,
  apiDeleteAllResumes,
  apiDeleteMasterResume,
  apiUpdateSettings,
} from '../lib/api.ts';
import {
  RESUME_TEMPLATES,
  TEMPLATE_CATEGORY_META,
  normalizeTemplateId,
} from '../lib/templates.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { GenerationMode, ResumeTemplateId, UserSettings } from '../types/resume.ts';

interface SettingsViewProps {
  settings: UserSettings;
  onSettingsUpdated: (settings: UserSettings) => void;
  onMasterDeleted: () => void;
  onHistoryCleared: () => void;
}

export function SettingsView({
  settings,
  onSettingsUpdated,
  onMasterDeleted,
  onHistoryCleared,
}: SettingsViewProps) {
  const { getToken, logout } = useAuth();
  const [fullName, setFullName] = useState(settings.fullName || settings.displayName || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [defaultMode, setDefaultMode] = useState<GenerationMode>(settings.defaultMode);
  const [defaultTemplate, setDefaultTemplate] = useState<ResumeTemplateId>(() =>
    normalizeTemplateId(settings.defaultTemplate),
  );
  const [saving, setSaving] = useState(false);
  const [deletingAction, setDeletingAction] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<'master' | 'history' | 'account' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSavePrefs = async () => {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const token = await getToken();
      const updated = await apiUpdateSettings(token, {
        defaultMode,
        defaultTemplate,
        fullName: fullName.trim() || null,
        displayName: fullName.trim() || null,
        phone: phone.trim() || null,
      });
      onSettingsUpdated(updated);
      setNotice('Account and tailoring preferences saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async (target: 'master' | 'history' | 'account') => {
    setError(null);
    setNotice(null);
    setDeletingAction(target);
    try {
      const token = await getToken();
      if (target === 'master') {
        await apiDeleteMasterResume(token);
        onMasterDeleted();
        setNotice('Permanent Master Resume deleted.');
      } else if (target === 'history') {
        await apiDeleteAllResumes(token);
        onHistoryCleared();
        setNotice('All generated resume history cleared.');
      } else {
        await apiDeleteAccountData(token);
        await logout();
      }
      setConfirmTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete operation failed.');
    } finally {
      setDeletingAction(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage default AI tailoring preferences and private data deletion controls.
        </p>
      </div>

      {/* Account Info */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Account</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-500 block">Signed-in Email</span>
            <span className="font-medium text-slate-900">{settings.email}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Account Role</span>
            <span className="font-medium capitalize text-slate-900">{settings.role}</span>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 ..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </div>
      </section>

      {/* Default Generation Settings */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <h2 className="text-sm font-semibold text-slate-900">Default Tailoring Preferences</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Default Generation Mode
            </label>
            <select
              value={defaultMode}
              onChange={(e) => setDefaultMode(e.target.value as GenerationMode)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="balanced">Balanced Resume</option>
              <option value="maximum_alignment">Maximum JD Alignment</option>
              <option value="conservative">Conservative Resume</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Default Document Template
            </label>
            <select
              value={normalizeTemplateId(defaultTemplate)}
              onChange={(e) => setDefaultTemplate(e.target.value as ResumeTemplateId)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {TEMPLATE_CATEGORY_META.map((cat) => (
                <optgroup key={cat.id} label={cat.label}>
                  {RESUME_TEMPLATES.filter((t) => t.category === cat.id).map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} ({tpl.atsLabel})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSavePrefs}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </section>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Privacy & Data Deletion */}
      <section className="rounded-xl border border-red-200 bg-white p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Privacy & Data Deletion</h2>
        <p className="text-xs text-slate-600">
          All Master Resumes and generated versions are stored privately under your authenticated
          account. You can permanently delete any dataset below.
        </p>

        <div className="divide-y divide-slate-100">
          <div className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900">Delete Master Resume</div>
              <div className="text-xs text-slate-500">
                Permanently removes your stored Master Resume profile.
              </div>
            </div>
            {confirmTarget === 'master' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeDelete('master')}
                  disabled={deletingAction !== null}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmTarget('master')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Master Resume</span>
              </button>
            )}
          </div>

          <div className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900">Clear Resume History</div>
              <div className="text-xs text-slate-500">
                Deletes all tailored resume versions and ATS reports.
              </div>
            </div>
            {confirmTarget === 'history' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeDelete('history')}
                  disabled={deletingAction !== null}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmTarget('history')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          <div className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900">
                Delete All Account Data & Sign Out
              </div>
              <div className="text-xs text-slate-500">
                Deletes your user record, Master Resume, and all generated resumes.
              </div>
            </div>
            {confirmTarget === 'account' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => executeDelete('account')}
                  disabled={deletingAction !== null}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  Confirm Full Deletion
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmTarget('account')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All Data</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
