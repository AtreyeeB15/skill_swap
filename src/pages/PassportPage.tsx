import React, { useEffect, useState, useCallback } from 'react';
import { Award, CheckCircle2, Star } from 'lucide-react';
import { apiFetch } from '../services/api';
import { UserProfile } from '../types';
import { LoadingSkeleton, ErrorBanner } from '../components/ui/StateViews';

interface PassportData {
  profile: UserProfile;
  completedExchanges: Array<{
    id: string;
    teacher_id: string;
    teacher_name: string;
    learner_name: string;
    skill_taught_name: string;
    skill_learned_name: string | null;
    mode: string;
    duration_minutes: number;
    project_note: string;
    completed_at: string;
  }>;
  milestonesCompleted: Array<{
    id: string;
    title: string;
    week_label: string;
    skill_name: string;
    completed_at: string;
  }>;
  allBadgeDefs: Array<{
    key: string;
    name: string;
    description: string;
  }>;
}

export const PassportPage: React.FC = () => {
  const [data, setData] = useState<PassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPassport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<PassportData>('/api/passport');
      setData(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPassport();
  }, [loadPassport]);

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error) return <ErrorBanner message={error} onRetry={loadPassport} />;
  if (!data) return null;

  const { profile, completedExchanges, milestonesCompleted, allBadgeDefs } = data;
  const earnedMap = new Map(profile.achievements.map((a) => [a.badge_key, a]));

  return (
    <div className="space-y-6">
      {/* Passport Summary */}
      <section className="rounded-xl bg-[#1B2A41] text-white p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-[#2CA69A]">Verified Skill Passport</p>
          <h2 className="mt-1 font-display font-bold text-2xl text-white">{profile.name}</h2>
          <p className="mt-1 text-sm text-[#F5F1E8]/80">
            Skills taught: {profile.teachSkills.map((s) => s.name).join(', ') || 'None'} · Learning:{' '}
            {profile.learnSkills.map((s) => s.name).join(', ') || 'None'}
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0 tabular-nums">
          <div>
            <p className="text-xs text-[#F5F1E8]/65">Completed</p>
            <p className="font-display font-bold text-2xl">{completedExchanges.length}</p>
          </div>
          <div>
            <p className="text-xs text-[#F5F1E8]/65">Badges</p>
            <p className="font-display font-bold text-2xl text-[#F47735]">
              {profile.achievements.length}/{allBadgeDefs.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#F5F1E8]/65">Rating</p>
            <p className="font-display font-bold text-2xl text-[#2CA69A]">
              {profile.reviewCount > 0 ? profile.avgRating : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Auto-Awarded Badges */}
      <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-6">
        <h3 className="font-display font-semibold text-base text-[#1B2A41] mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-[#F47735]" />
          Badges & Milestones
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {allBadgeDefs.map((def) => {
            const earned = earnedMap.get(def.key);
            return (
              <div
                key={def.key}
                className={`rounded-xl border p-4 ${
                  earned
                    ? 'bg-[#F5F1E8]/70 border-[#2CA69A]/40'
                    : 'bg-white border-[#1B2A41]/10 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Award className={`w-5 h-5 ${earned ? 'text-[#F47735]' : 'text-[#1B2A41]/30'}`} />
                  {earned && <CheckCircle2 className="w-4 h-4 text-[#2CA69A]" />}
                </div>
                <p className="text-sm font-semibold text-[#1B2A41]">{def.name}</p>
                <p className="mt-1 text-xs text-[#1B2A41]/70 leading-relaxed">{def.description}</p>
                <p className="mt-2 text-[11px] font-mono text-[#1B2A41]/60 tabular-nums">
                  {earned ? `Earned ${new Date(earned.awarded_at).toLocaleDateString()}` : 'Locked'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Completed Exchanges & Projects */}
        <section className="lg:col-span-7 rounded-xl bg-white border border-[#1B2A41]/10 p-6">
          <h3 className="font-display font-semibold text-base text-[#1B2A41] mb-4">
            Completed Exchanges & Projects
          </h3>
          {completedExchanges.length === 0 ? (
            <p className="text-sm text-[#1B2A41]/60">Complete an exchange to record it on your Skill Passport.</p>
          ) : (
            <div className="divide-y divide-[#1B2A41]/8">
              {completedExchanges.map((ex) => (
                <div key={ex.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#1B2A41]/60 tabular-nums">
                    <span className="font-medium text-[#2CA69A] capitalize">{ex.mode} exchange</span>
                    <span>{new Date(ex.completed_at).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-[#1B2A41]">
                    {ex.skill_taught_name}
                    {ex.skill_learned_name ? ` ⇄ ${ex.skill_learned_name}` : ''}
                  </p>
                  <p className="text-xs text-[#1B2A41]/70">
                    Teacher: {ex.teacher_name} · Learner: {ex.learner_name} · {ex.duration_minutes} min
                  </p>
                  {ex.project_note && (
                    <p className="mt-1.5 text-xs text-[#1B2A41]/85 bg-[#F5F1E8]/60 rounded-lg px-3 py-2">
                      Project takeaway: {ex.project_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Peer Feedback + Roadmap Milestones */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-6">
            <h3 className="font-display font-semibold text-base text-[#1B2A41] mb-4">Peer Feedback</h3>
            {profile.reviews.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/60">No peer feedback received yet.</p>
            ) : (
              <div className="divide-y divide-[#1B2A41]/8">
                {profile.reviews.map((r) => (
                  <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1B2A41]">{r.reviewer_name}</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[#F47735] tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[#F47735]" /> {r.rating}/5
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#1B2A41]/80">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-6">
            <h3 className="font-display font-semibold text-base text-[#1B2A41] mb-4">
              Completed Roadmap Milestones ({milestonesCompleted.length})
            </h3>
            {milestonesCompleted.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/60">Tick off roadmap milestones to build your learning log.</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {milestonesCompleted.map((m) => (
                  <li key={m.id} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2CA69A] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#1B2A41]">{m.title}</p>
                      <p className="text-[#1B2A41]/65">
                        {m.skill_name} · {m.week_label}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
