import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Clock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { PreferredMethod, SessionItem, UserProfile } from '../types';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export const SchedulePage: React.FC = () => {
  const { user, showToast } = useAuth();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [peers, setPeers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');

  // Create form
  const [createOpen, setCreateOpen] = useState(Boolean(searchParams.get('partner')));
  const [title, setTitle] = useState('');
  const [skillName, setSkillName] = useState('');
  const [guestId, setGuestId] = useState(searchParams.get('partner') || '');
  const [scheduledDate, setScheduledDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('18:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [method, setMethod] = useState<PreferredMethod>('online');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reschedule & Cancel state
  const [rescheduleTarget, setRescheduleTarget] = useState<SessionItem | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [cancelTarget, setCancelTarget] = useState<SessionItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sessRes, peerRes] = await Promise.all([
        apiFetch<{ sessions: SessionItem[] }>('/api/sessions'),
        apiFetch<{ peers: UserProfile[] }>('/api/explore'),
      ]);
      setSessions(sessRes.sessions);
      setPeers(peerRes.peers);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          exchangeId: searchParams.get('exchange') || null,
          guestId: guestId || null,
          title,
          skillName,
          scheduledDate,
          startTime,
          durationMinutes,
          method,
          notes,
        }),
      });
      showToast('Session scheduled.', 'success');
      setCreateOpen(false);
      setTitle('');
      setSkillName('');
      setNotes('');
      await loadData();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (sessionId: string, status: string) => {
    setSubmitting(true);
    try {
      await apiFetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`Session marked ${status}.`, 'success');
      await loadData();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
      setCancelTarget(null);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/sessions/${rescheduleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rescheduled',
          scheduledDate: reschedDate,
          startTime: reschedTime,
        }),
      });
      showToast('Session rescheduled.', 'success');
      setRescheduleTarget(null);
      await loadData();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const visibleSessions = sessions.filter((s) => {
    if (filter === 'upcoming') return ['requested', 'accepted', 'rescheduled'].includes(s.status);
    return s.status === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#1B2A41]/12 rounded-xl">
          {(['upcoming', 'completed', 'cancelled'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-[#1B2A41] text-white' : 'text-[#1B2A41]/70 hover:text-[#1B2A41]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Session</span>
        </button>
      </div>

      {createOpen && (
        <form onSubmit={handleCreate} className="rounded-xl bg-white border border-[#1B2A41]/15 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base text-[#1B2A41]">New 1:1 Learning Session</h2>
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
                placeholder="e.g. React Hooks Walkthrough"
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
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Peer Partner</label>
              <select
                value={guestId}
                onChange={(e) => setGuestId(e.target.value)}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm"
              >
                <option value="">Open / Self-scheduled</option>
                {peers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
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
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Start Time</label>
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
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Duration</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-2.5 py-2 text-sm tabular-nums"
                >
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                </select>
              </div>
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
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Agenda / Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Meeting link, library room, or topics to prepare..."
              className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium rounded-lg bg-[#F47735] text-white">
              {submitting ? 'Saving...' : 'Create Session'}
            </button>
          </div>
        </form>
      )}

      {loading && <LoadingSkeleton rows={3} />}
      {!loading && error && <ErrorBanner message={error} onRetry={loadData} />}

      {!loading && !error && visibleSessions.length === 0 && (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title={`No ${filter} sessions`}
          description="Schedule a 15–60 minute peer learning session to keep your exchange on track."
          actionLabel="Schedule Session"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {!loading && !error && visibleSessions.length > 0 && (
        <div className="space-y-4">
          {visibleSessions.map((s) => {
            const isParticipant = s.host_id === user?.id || s.guest_id === user?.id;
            const isGuestPending = s.status === 'requested' && s.guest_id === user?.id;
            return (
              <article
                key={s.id}
                className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-[#1B2A41]/65 flex-wrap tabular-nums">
                    <span className="font-semibold text-[#2CA69A] capitalize">{s.status}</span>
                    <span aria-hidden="true">·</span>
                    <span>{s.skill_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {s.scheduled_date} at {s.start_time} ({s.duration_minutes} min)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{s.method}</span>
                  </div>
                  <h3 className="font-display font-semibold text-base text-[#1B2A41]">{s.title}</h3>
                  <p className="text-xs text-[#1B2A41]/70">
                    Host: {s.host_name}
                    {s.guest_name ? ` · Guest: ${s.guest_name}` : ''}
                    {s.circle_name ? ` · Circle: ${s.circle_name}` : ''}
                    {s.notes ? ` · ${s.notes}` : ''}
                  </p>
                </div>

                {isParticipant && ['requested', 'accepted', 'rescheduled'].includes(s.status) && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isGuestPending && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(s.id, 'accepted')}
                        className="px-3.5 py-2 rounded-lg bg-[#2CA69A] text-white text-xs font-medium"
                      >
                        Accept
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRescheduleTarget(s);
                        setReschedDate(s.scheduled_date);
                        setReschedTime(s.start_time);
                      }}
                      className="px-3.5 py-2 rounded-lg border border-[#1B2A41]/15 text-xs font-medium text-[#1B2A41] hover:bg-[#F5F1E8]"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(s.id, 'completed')}
                      className="px-3.5 py-2 rounded-lg bg-[#1B2A41] text-white text-xs font-medium"
                    >
                      Mark Done
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelTarget(s)}
                      className="px-3.5 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2A41]/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-[#1B2A41]/12 p-6 shadow-xl">
            <h2 className="font-display font-semibold text-lg text-[#1B2A41]">Reschedule Session</h2>
            <p className="text-xs text-[#1B2A41]/65 mt-1">{rescheduleTarget.title}</p>
            <form onSubmit={handleReschedule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">New Date</label>
                <input
                  type="date"
                  required
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">New Start Time</label>
                <input
                  type="time"
                  required
                  value={reschedTime}
                  onChange={(e) => setReschedTime(e.target.value)}
                  className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#F47735] text-white"
                >
                  Save New Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel Scheduled Session?"
        description={`Are you sure you want to cancel "${cancelTarget?.title}"? Your partner will be notified.`}
        confirmLabel="Yes, Cancel Session"
        tone="danger"
        busy={submitting}
        onConfirm={() => cancelTarget && handleUpdateStatus(cancelTarget.id, 'cancelled')}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
};
