import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, MessageSquare, Sparkles, Clock } from 'lucide-react';
import { apiFetch } from '../services/api';
import { DashboardData, UserProfile } from '../types';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';
import { Avatar } from '../components/ui/Avatar';
import { ExchangeRequestModal } from '../components/ui/ExchangeRequestModal';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectPeer, setConnectPeer] = useState<UserProfile | null>(null);
  const navigate = useNavigate();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error) return <ErrorBanner message={error} onRetry={loadDashboard} />;
  if (!data) return null;

  const { profile, profileCompletion, upcomingSessions, pendingRequests, recentMessages, roadmapProgress, topMatches } = data;

  return (
    <div className="space-y-6">
      {/* Welcome & Profile Completion */}
      <section className="rounded-xl bg-[#1B2A41] text-white p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-medium text-[#2CA69A]">SkillSwap Workspace · Learn by Sharing. Grow Together.</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
            Welcome back, {profile.name.split(' ')[0]}
          </h2>
          <p className="text-sm text-[#F5F1E8]/80">
            You have <span className="font-semibold text-white tabular-nums">{pendingRequests.length}</span> pending exchange request(s) and{' '}
            <span className="font-semibold text-white tabular-nums">{upcomingSessions.length}</span> upcoming session(s).
          </p>
        </div>

        <div className="w-full lg:w-72 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5F1E8]/80">Profile completion</span>
            <span className="font-mono font-semibold text-white tabular-nums">{profileCompletion}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-[#2CA69A] rounded-full transition-all"
              style={{ width: `${profileCompletion}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Link to="/profile" className="text-xs font-medium text-[#F47735] hover:underline">
              Edit profile & skills
            </Link>
            <Link to="/explore" className="text-xs font-medium text-[#F5F1E8]/85 hover:text-white">
              Find peers →
            </Link>
          </div>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/wallet"
          className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 hover:border-[#1B2A41]/25 transition-colors"
        >
          <p className="text-xs text-[#1B2A41]/65">Credit Balance</p>
          <p className="mt-1.5 font-display font-bold text-2xl text-[#1B2A41] tabular-nums">
            {profile.wallet.balance} <span className="text-sm font-normal text-[#1B2A41]/60">credits</span>
          </p>
          <p className="mt-1 text-xs text-[#2CA69A] tabular-nums">
            {profile.wallet.total_earned} earned · {profile.wallet.total_spent} spent
          </p>
        </Link>

        <Link
          to="/exchanges"
          className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 hover:border-[#1B2A41]/25 transition-colors"
        >
          <p className="text-xs text-[#1B2A41]/65">Completed Exchanges</p>
          <p className="mt-1.5 font-display font-bold text-2xl text-[#1B2A41] tabular-nums">
            {profile.completedExchanges}
          </p>
          <p className="mt-1 text-xs text-[#1B2A41]/60 tabular-nums">
            {profile.achievements.length} badges unlocked
          </p>
        </Link>

        <Link
          to="/passport"
          className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 hover:border-[#1B2A41]/25 transition-colors"
        >
          <p className="text-xs text-[#1B2A41]/65">Average Peer Rating</p>
          <p className="mt-1.5 font-display font-bold text-2xl text-[#1B2A41] tabular-nums">
            {profile.reviewCount > 0 ? `${profile.avgRating} / 5.0` : 'No reviews'}
          </p>
          <p className="mt-1 text-xs text-[#1B2A41]/60 tabular-nums">
            {profile.reviewCount} verified review(s)
          </p>
        </Link>

        <Link
          to="/profile"
          className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 hover:border-[#1B2A41]/25 transition-colors"
        >
          <p className="text-xs text-[#1B2A41]/65">Your Skill Portfolio</p>
          <p className="mt-1.5 font-display font-bold text-2xl text-[#1B2A41] tabular-nums">
            {profile.teachSkills.length} <span className="text-sm font-normal text-[#1B2A41]/60">teach</span> ·{' '}
            {profile.learnSkills.length} <span className="text-sm font-normal text-[#1B2A41]/60">learn</span>
          </p>
          <p className="mt-1 text-xs text-[#1B2A41]/60">
            Preferred: {profile.preferred_method}
          </p>
        </Link>
      </section>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols */}
        <div className="lg:col-span-7 space-y-6">
          {/* Top Matches */}
          <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F47735]" />
                <h3 className="font-display font-semibold text-base text-[#1B2A41]">Top Skill Matches</h3>
              </div>
              <Link to="/matches" className="text-xs font-medium text-[#2CA69A] hover:underline whitespace-nowrap">
                Run AI Match →
              </Link>
            </div>

            {topMatches.length === 0 ? (
              <EmptyState
                title="No peer matches yet"
                description="Add skills you teach and want to learn so SkillSwap can score compatible peers."
                actionLabel="Update Skills"
                onAction={() => navigate('/profile')}
              />
            ) : (
              <div className="divide-y divide-[#1B2A41]/8">
                {topMatches.map((peer) => (
                  <div key={peer.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <Avatar name={peer.name} src={peer.avatar_url} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/peers/${peer.id}`}
                            className="text-sm font-semibold text-[#1B2A41] hover:text-[#F47735] truncate"
                          >
                            {peer.name}
                          </Link>
                          <span className="text-xs font-mono font-semibold text-[#2CA69A] tabular-nums">
                            {peer.matchScore}% match
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#1B2A41]/65 truncate">
                          Teaches: {peer.teachSkills.map((s) => s.name).join(', ') || 'General'} · {peer.preferred_method}
                        </p>
                        <p className="mt-1 text-xs text-[#1B2A41]/80">{peer.why}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConnectPeer(peer)}
                      className="px-3.5 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Sessions */}
          <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2CA69A]" />
                <h3 className="font-display font-semibold text-base text-[#1B2A41]">Upcoming Sessions</h3>
              </div>
              <Link to="/schedule" className="text-xs font-medium text-[#2CA69A] hover:underline whitespace-nowrap">
                Full Schedule →
              </Link>
            </div>

            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/65 py-2">
                No upcoming sessions scheduled.{' '}
                <Link to="/schedule" className="text-[#F47735] font-medium hover:underline">
                  Schedule a session
                </Link>
              </p>
            ) : (
              <div className="divide-y divide-[#1B2A41]/8">
                {upcomingSessions.map((s) => (
                  <div key={s.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1B2A41] truncate">{s.title}</p>
                      <p className="text-xs text-[#1B2A41]/65 mt-0.5 tabular-nums">
                        {s.scheduled_date} at {s.start_time} · {s.duration_minutes} min · {s.method} · {s.skill_name}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[#2CA69A] capitalize shrink-0">{s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Your Teach & Learn Skills */}
          <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base text-[#1B2A41]">Teach & Learn Skills</h3>
              <Link to="/profile" className="text-xs font-medium text-[#2CA69A] hover:underline">
                Manage →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-[#1B2A41]/60 mb-2">Teaching</p>
                {profile.teachSkills.length === 0 ? (
                  <p className="text-xs text-[#1B2A41]/55">No teaching skills added yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {profile.teachSkills.map((s) => (
                      <li key={s.id} className="text-sm text-[#1B2A41] flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{s.name}</span>
                        <span className="text-xs text-[#2CA69A] capitalize shrink-0">{s.proficiency}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#1B2A41]/60 mb-2">Learning</p>
                {profile.learnSkills.length === 0 ? (
                  <p className="text-xs text-[#1B2A41]/55">No learning goals added yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {profile.learnSkills.map((s) => (
                      <li key={s.id} className="text-sm text-[#1B2A41] flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{s.name}</span>
                        <span className="text-xs text-[#F47735] capitalize shrink-0">{s.proficiency}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right 5 cols */}
        <div className="lg:col-span-5 space-y-6">
          {/* Pending Exchange Requests */}
          <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#F47735]" />
                <h3 className="font-display font-semibold text-base text-[#1B2A41]">Pending Requests</h3>
              </div>
              <Link to="/exchanges" className="text-xs font-medium text-[#2CA69A] hover:underline">
                Review all →
              </Link>
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/65">No pending requests right now.</p>
            ) : (
              <div className="divide-y divide-[#1B2A41]/8">
                {pendingRequests.map((req) => {
                  const incoming = req.receiver_id === profile.id;
                  return (
                    <div key={req.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1B2A41] truncate">
                          {incoming ? `From ${req.sender_name}` : `To ${req.receiver_name}`}
                        </p>
                        <p className="text-xs text-[#1B2A41]/65 mt-0.5 truncate">
                          {req.requested_skill_name} · {req.mode === 'swap' ? 'Swap' : `${req.credit_cost} Cr`} ·{' '}
                          {req.duration_minutes}m
                        </p>
                      </div>
                      <Link
                        to="/exchanges"
                        className="text-xs font-medium text-[#F47735] hover:underline whitespace-nowrap shrink-0"
                      >
                        {incoming ? 'Respond' : 'View'}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Messages */}
          <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#2CA69A]" />
                <h3 className="font-display font-semibold text-base text-[#1B2A41]">Recent Messages</h3>
              </div>
              <Link to="/messages" className="text-xs font-medium text-[#2CA69A] hover:underline">
                Open Chat →
              </Link>
            </div>
            {recentMessages.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/65">No conversations yet.</p>
            ) : (
              <div className="divide-y divide-[#1B2A41]/8">
                {recentMessages.map((m) => (
                  <Link
                    key={m.conversation_id}
                    to="/messages"
                    className="py-3 first:pt-0 last:pb-0 flex items-start gap-3 hover:opacity-85 transition-opacity"
                  >
                    <Avatar name={m.peer_name} src={m.peer_avatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1B2A41] truncate">{m.peer_name}</p>
                      <p className="text-xs text-[#1B2A41]/70 truncate">{m.content}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Roadmap Progress */}
          <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-base text-[#1B2A41]">Learning Roadmaps</h3>
              <Link to="/roadmap" className="text-xs font-medium text-[#2CA69A] hover:underline">
                Manage →
              </Link>
            </div>
            {roadmapProgress.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-[#1B2A41]/65">No active learning roadmaps yet.</p>
                <Link
                  to="/roadmap"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F47735] hover:underline"
                >
                  Generate your first AI roadmap <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {roadmapProgress.map((rm) => (
                  <Link key={rm.id} to="/roadmap" className="block group">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-[#1B2A41] group-hover:text-[#F47735] truncate">
                        {rm.skill_name} → {rm.target_level}
                      </span>
                      <span className="font-mono text-[#1B2A41]/75 tabular-nums shrink-0">
                        {rm.done}/{rm.total} ({rm.percent}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F5F1E8] overflow-hidden">
                      <div className="h-full bg-[#2CA69A] rounded-full" style={{ width: `${rm.percent}%` }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ExchangeRequestModal
        open={Boolean(connectPeer)}
        peer={connectPeer}
        onClose={() => setConnectPeer(null)}
        onSent={loadDashboard}
      />
    </div>
  );
};
