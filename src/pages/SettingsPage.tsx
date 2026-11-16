import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { PreferredMethod } from '../types';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser, showToast, logout } = useAuth();
  const [preferredMethod, setPreferredMethod] = useState<PreferredMethod>(user?.preferred_method || 'online');
  const [creditsPer30, setCreditsPer30] = useState<number>(user?.credits_per_30min || 1);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/profiles/me', {
        method: 'PUT',
        body: JSON.stringify({
          preferred_method: preferredMethod,
          credits_per_30min: creditsPer30,
        }),
      });
      await refreshUser();
      showToast('Settings updated.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-6 sm:p-8">
        <h2 className="font-display font-semibold text-lg text-[#1B2A41]">Exchange & Credit Preferences</h2>
        <p className="mt-1 text-sm text-[#1B2A41]/65">
          Configure your default teaching rate and session delivery preference.
        </p>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div>
            <label htmlFor="set-method" className="block text-xs font-medium text-[#1B2A41]/80 mb-1.5">
              Default Exchange Method
            </label>
            <select
              id="set-method"
              value={preferredMethod}
              onChange={(e) => setPreferredMethod(e.target.value as PreferredMethod)}
              className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3.5 py-2.5 text-sm"
            >
              <option value="online">Online (Video / Screen Share)</option>
              <option value="in-person">In-Person (On Campus)</option>
              <option value="chat">Async Chat</option>
            </select>
          </div>

          <div>
            <label htmlFor="set-rate" className="block text-xs font-medium text-[#1B2A41]/80 mb-1.5">
              Credits Charged per 30-Minute Teaching Session (Default: 1)
            </label>
            <input
              id="set-rate"
              type="number"
              min={1}
              max={10}
              value={creditsPer30}
              onChange={(e) => setCreditsPer30(Number(e.target.value))}
              className="w-32 rounded-lg border border-[#1B2A41]/20 px-3.5 py-2 text-sm font-mono tabular-nums"
            />
            <p className="mt-1 text-xs text-[#1B2A41]/60">
              Applies when peers book credit-based sessions with you. Two-way swaps always cost 0 credits.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-6 sm:p-8 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-semibold text-base text-[#1B2A41]">Account Session</h3>
          <p className="text-xs text-[#1B2A41]/65 mt-0.5">Signed in as {user.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </section>
    </div>
  );
};
