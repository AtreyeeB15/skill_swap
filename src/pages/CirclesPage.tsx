import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Calendar, UserPlus, X } from 'lucide-react';
import { apiFetch } from '../services/api';
import { SkillCircle, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export const CirclesPage: React.FC = () => {
  const { showToast } = useAuth();
  const [circles, setCircles] = useState<SkillCircle[]>([]);
  const [peers, setPeers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create circle form
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [focusSkill, setFocusSkill] = useState('');
  const [teachingSkill, setTeachingSkill] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  // Join / Leave / Invite / Schedule Session modals
  const [joinTarget, setJoinTarget] = useState<SkillCircle | null>(null);
  const [joinSkill, setJoinSkill] = useState('');
  const [leaveTarget, setLeaveTarget] = useState<SkillCircle | null>(null);
  const [inviteTarget, setInviteTarget] = useState<SkillCircle | null>(null);
  const [invitePeerId, setInvitePeerId] = useState('');
  const [sessionCircle, setSessionCircle] = useState<SkillCircle | null>(null);
  const [sessTitle, setSessTitle] = useState('');
  const [sessSkill, setSessSkill] = useState('');
  const [sessDate, setSessDate] = useState(() => new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10));
  const [sessTime, setSessTime] = useState('17:30');
  const [sessDur, setSessDur] = useState(45);

  const loadCircles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, pRes] = await Promise.all([
        apiFetch<{ circles: SkillCircle[] }>('/api/circles'),
        apiFetch<{ peers: UserProfile[] }>('/api/explore'),
      ]);
      setCircles(cRes.circles);
      setPeers(pRes.peers);
      if (pRes.peers.length > 0 && !invitePeerId) {
        setInvitePeerId(pRes.peers[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [invitePeerId]);

  useEffect(() => {
    loadCircles();
  }, [loadCircles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/circles', {
        method: 'POST',
        body: JSON.stringify({ name, focusSkill, teachingSkill, description }),
      });
      showToast(`Skill Circle "${name}" created.`, 'success');
      setCreateOpen(false);
      setName('');
      setFocusSkill('');
      setTeachingSkill('');
      setDescription('');
      await loadCircles();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/circles/${joinTarget.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ teachingSkill: joinSkill }),
      });
      showToast(`Joined "${joinTarget.name}".`, 'success');
      setJoinTarget(null);
      setJoinSkill('');
      await loadCircles();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/circles/${leaveTarget.id}/leave`, { method: 'POST' });
      showToast(`Left "${leaveTarget.name}".`, 'info');
      setLeaveTarget(null);
      await loadCircles();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteTarget || !invitePeerId) return;
    setBusy(true);
    try {
      await apiFetch(`/api/circles/${inviteTarget.id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId: invitePeerId }),
      });
      showToast('Invitation notification sent.', 'success');
      setInviteTarget(null);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddGroupSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCircle) return;
    setBusy(true);
    try {
      await apiFetch(`/api/circles/${sessionCircle.id}/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          title: sessTitle,
          skillName: sessSkill,
          scheduledDate: sessDate,
          startTime: sessTime,
          durationMinutes: sessDur,
        }),
      });
      showToast('Group session added to circle.', 'success');
      setSessionCircle(null);
      setSessTitle('');
      setSessSkill('');
      await loadCircles();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[#1B2A41]/75">
          Small peer study circles where each member contributes a distinct skill and hosts group workshops.
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Create Skill Circle</span>
        </button>
      </div>

      {createOpen && (
        <form onSubmit={handleCreate} className="rounded-xl bg-white border border-[#1B2A41]/15 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base text-[#1B2A41]">Create Group Skill Circle</h2>
            <button type="button" onClick={() => setCreateOpen(false)} className="text-[#1B2A41]/50 hover:text-[#1B2A41]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Circle Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Data Science & Viz Lab"
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Focus Domain</label>
              <input
                type="text"
                required
                value={focusSkill}
                onChange={(e) => setFocusSkill(e.target.value)}
                placeholder="e.g. Python & Data Science"
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Skill You Will Teach</label>
              <input
                type="text"
                required
                value={teachingSkill}
                onChange={(e) => setTeachingSkill(e.target.value)}
                placeholder="e.g. React Dashboards"
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this circle collaborate on?"
              className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-5 py-2 text-sm font-medium rounded-lg bg-[#F47735] text-white">
              Create Circle
            </button>
          </div>
        </form>
      )}

      {loading && <LoadingSkeleton rows={2} />}
      {!loading && error && <ErrorBanner message={error} onRetry={loadCircles} />}

      {!loading && !error && circles.length === 0 && (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="No Skill Circles yet"
          description="Create a collaborative group where peers teach complementary skills to one another."
          actionLabel="Create First Circle"
          onAction={() => setCreateOpen(true)}
        />
      )}

      {!loading && !error && circles.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {circles.map((circle) => (
            <article key={circle.id} className="rounded-xl bg-white border border-[#1B2A41]/10 p-6 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-[#2CA69A] tabular-nums">
                      Focus: {circle.focus_skill} · {circle.members.length}/{circle.max_members} members
                    </p>
                    <h3 className="mt-1 font-display font-bold text-lg text-[#1B2A41]">{circle.name}</h3>
                  </div>
                  {circle.isMember ? (
                    <button
                      type="button"
                      onClick={() => setLeaveTarget(circle)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium shrink-0"
                    >
                      Leave
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setJoinTarget(circle);
                        setJoinSkill('');
                      }}
                      className="px-4 py-1.5 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-xs font-medium shrink-0"
                    >
                      Join Circle
                    </button>
                  )}
                </div>

                <p className="text-sm text-[#1B2A41]/75 leading-relaxed">{circle.description}</p>

                {/* Members & Teaching Roles */}
                <div className="pt-3 border-t border-[#1B2A41]/8">
                  <p className="text-xs font-semibold text-[#1B2A41]/65 mb-2.5">Members & Skills Contributed</p>
                  <div className="space-y-2">
                    {circle.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={m.name} src={m.avatar_url} size="xs" />
                          <span className="font-medium text-[#1B2A41] truncate">{m.name}</span>
                          <span className="text-[#1B2A41]/50">({m.role})</span>
                        </div>
                        <span className="text-[#2CA69A] font-medium truncate">
                          {m.teaching_skill || 'Participant'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upcoming Group Sessions */}
                <div className="pt-3 border-t border-[#1B2A41]/8">
                  <p className="text-xs font-semibold text-[#1B2A41]/65 mb-2">Upcoming Group Sessions</p>
                  {circle.sessions.length === 0 ? (
                    <p className="text-xs text-[#1B2A41]/55">No group sessions scheduled yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {circle.sessions.map((s) => (
                        <div key={s.id} className="text-xs bg-[#F5F1E8]/60 rounded-lg px-3 py-2">
                          <p className="font-semibold text-[#1B2A41]">{s.title}</p>
                          <p className="text-[#1B2A41]/70 tabular-nums mt-0.5">
                            {s.scheduled_date} at {s.start_time} · {s.duration_minutes}m · Led by {s.host_name} ({s.skill_name})
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {circle.isMember && (
                <div className="pt-3 border-t border-[#1B2A41]/8 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setInviteTarget(circle)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1B2A41]/15 text-xs font-medium text-[#1B2A41] hover:bg-[#F5F1E8]"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Invite Peer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionCircle(circle);
                      setSessSkill(circle.focus_skill);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1B2A41] hover:bg-[#263A57] text-white text-xs font-medium"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Schedule Group Session
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Join Circle Modal */}
      {joinTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2A41]/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="font-display font-semibold text-lg text-[#1B2A41]">Join {joinTarget.name}</h2>
            <form onSubmit={handleJoin} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">
                  Skill you can teach or share with this circle
                </label>
                <input
                  type="text"
                  required
                  value={joinSkill}
                  onChange={(e) => setJoinSkill(e.target.value)}
                  placeholder="e.g. TypeScript Testing or Figma"
                  className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setJoinTarget(null)} className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium rounded-lg bg-[#F47735] text-white">
                  Confirm Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Peer Modal */}
      {inviteTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2A41]/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="font-display font-semibold text-lg text-[#1B2A41]">Invite Peer to {inviteTarget.name}</h2>
            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <select
                value={invitePeerId}
                onChange={(e) => setInvitePeerId(e.target.value)}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2.5 text-sm"
              >
                {peers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.teachSkills.map((s) => s.name).slice(0, 2).join(', ')})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setInviteTarget(null)} className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium rounded-lg bg-[#2CA69A] text-white">
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Group Session Modal */}
      {sessionCircle && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2A41]/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="font-display font-semibold text-lg text-[#1B2A41]">Schedule Session in {sessionCircle.name}</h2>
            <form onSubmit={handleAddGroupSession} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Workshop Title</label>
                <input
                  type="text"
                  required
                  value={sessTitle}
                  onChange={(e) => setSessTitle(e.target.value)}
                  placeholder="e.g. Live SQL Query Optimization"
                  className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">Skill Taught</label>
                <input
                  type="text"
                  required
                  value={sessSkill}
                  onChange={(e) => setSessSkill(e.target.value)}
                  className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  required
                  value={sessDate}
                  onChange={(e) => setSessDate(e.target.value)}
                  className="rounded-lg border border-[#1B2A41]/20 px-2.5 py-2 text-xs tabular-nums"
                />
                <input
                  type="time"
                  required
                  value={sessTime}
                  onChange={(e) => setSessTime(e.target.value)}
                  className="rounded-lg border border-[#1B2A41]/20 px-2.5 py-2 text-xs tabular-nums"
                />
                <select
                  value={sessDur}
                  onChange={(e) => setSessDur(Number(e.target.value))}
                  className="rounded-lg border border-[#1B2A41]/20 bg-white px-2.5 py-2 text-xs tabular-nums"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSessionCircle(null)} className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium rounded-lg bg-[#F47735] text-white">
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(leaveTarget)}
        title="Leave Skill Circle?"
        description={`Are you sure you want to leave "${leaveTarget?.name}"? You can rejoin later if seats remain open.`}
        confirmLabel="Yes, Leave Circle"
        tone="danger"
        busy={busy}
        onConfirm={handleLeave}
        onCancel={() => setLeaveTarget(null)}
      />
    </div>
  );
};
