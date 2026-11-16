import React, { useEffect, useState, useCallback } from 'react';
import { Search, Zap, Plus, X, Check } from 'lucide-react';
import { apiFetch } from '../services/api';
import { PreferredMethod, SessionItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';

export const MicroSessionsPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [skillName, setSkillName] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('19:00');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [method, setMethod] = useState<PreferredMethod>('online');
  const [maxParticipants, setMaxParticipants] = useState(6);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMicro = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ sessions: SessionItem[] }>('/api/sessions?scope=micro');
      setSessions(res.sessions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMicro();
  }, [loadMicro]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          title,
          skillName,
          scheduledDate,
          startTime,
          durationMinutes,
          method,
          isMicro: true,
          maxParticipants,
          notes,
        }),
      });
      showToast('Micro-Skill Session published!', 'success');
      setCreateOpen(false);
      setTitle('');
      setSkillName('');
      setNotes('');
      await loadMicro();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (sessionId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/sessions/${sessionId}/join`, { method: 'POST' });
      showToast('You joined the micro-skill session!', 'success');
      await loadMicro();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const filtered = sessions.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      s.skill_name.toLowerCase().includes(q) ||
      s.host_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#1B2A41]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 15–30 min micro-sessions by skill or host..."
            className="w-full rounded-lg border border-[#1B2A41]/20 pl-9 pr-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Host Micro-Session</span>
        </button>
      </section>

      {createOpen && (
        <form onSubmit={handleCreate} className="rounded-xl bg-white border border-[#1B2A41]/15 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base text-[#1B2A41]">Host a 15–30 Min Micro-Skill Session</h2>
            <button type="button" onClick={() => setCreateOpen(false)} className="text-[#1B2A41]/50 hover:text-[#1B2A41]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Session Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 20-Min CSS Grid Sprint"
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Skill Topic</label>
              <input
                type="text"
                required
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="e.g. React & TypeScript"
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Duration (15–30 min)</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm tabular-nums"
              >
                <option value={15}>15 minutes</option>
                <option value={20}>20 minutes</option>
                <option value={25}>25 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Date</label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PreferredMethod)}
                  className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-2.5 py-2 text-sm"
                >
                  <option value="online">Online</option>
                  <option value="in-person">In-Person</option>
                  <option value="chat">Chat</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Max Seats</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#1B2A41]/20 px-2.5 py-2 text-sm tabular-nums"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Focus Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What one concrete takeaway will attendees leave with?"
              className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 text-sm font-medium rounded-lg bg-[#F47735] text-white">
              Publish Session
            </button>
          </div>
        </form>
      )}

      {loading && <LoadingSkeleton rows={3} />}
      {!loading && error && <ErrorBanner message={error} onRetry={loadMicro} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon={<Zap className="w-6 h-6" />}
          title="No micro-skill sessions match"
          description="Host a focused 15–30 minute session to teach one practical technique."
          actionLabel="Host Micro-Session"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((s) => {
            const isHost = s.host_id === user?.id;
            const full = s.participant_count >= s.max_participants;
            return (
              <article key={s.id} className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="font-semibold text-[#2CA69A]">{s.duration_minutes} min · {s.skill_name}</span>
                    <span className="capitalize text-[#1B2A41]/65">{s.status}</span>
                  </div>
                  <h3 className="font-display font-semibold text-base text-[#1B2A41]">{s.title}</h3>
                  <p className="text-xs text-[#1B2A41]/75 leading-relaxed">{s.notes || 'Focused live micro-workshop.'}</p>
                  <div className="flex items-center gap-2.5 pt-1">
                    <Avatar name={s.host_name} src={s.host_avatar} size="xs" />
                    <span className="text-xs text-[#1B2A41]/75">
                      Hosted by <strong>{s.host_name}</strong> · {s.scheduled_date} {s.start_time}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1B2A41]/8 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-[#1B2A41]/70 tabular-nums">
                    {s.participant_count}/{s.max_participants} joined · {s.method}
                  </span>
                  {isHost ? (
                    <span className="text-xs font-medium text-[#1B2A41]/65">Your Session</span>
                  ) : s.user_joined ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2CA69A]">
                      <Check className="w-3.5 h-3.5" /> Joined
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || full}
                      onClick={() => handleJoin(s.id)}
                      className="px-4 py-1.5 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-xs font-medium disabled:opacity-50"
                    >
                      {full ? 'Full' : 'Join Seat'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
