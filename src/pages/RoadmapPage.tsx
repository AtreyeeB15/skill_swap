import React, { useEffect, useState, useCallback } from 'react';
import { Map as MapIcon, CheckSquare, Square, Trash2, Sparkles } from 'lucide-react';
import { apiFetch } from '../services/api';
import { RoadmapItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export const RoadmapPage: React.FC = () => {
  const { showToast } = useAuth();
  const [roadmaps, setRoadmaps] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [skill, setSkill] = useState('');
  const [currentLevel, setCurrentLevel] = useState('beginner');
  const [targetLevel, setTargetLevel] = useState('intermediate');
  const [weeklyHours, setWeeklyHours] = useState(4);
  const [generating, setGenerating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<RoadmapItem | null>(null);

  const loadRoadmaps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ roadmaps: RoadmapItem[] }>('/api/roadmaps');
      setRoadmaps(res.roadmaps);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoadmaps();
  }, [loadRoadmaps]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skill.trim()) return;
    setGenerating(true);
    try {
      const res = await apiFetch<{ roadmap: RoadmapItem }>('/api/roadmaps/generate', {
        method: 'POST',
        body: JSON.stringify({ skill: skill.trim(), currentLevel, targetLevel, weeklyHours }),
      });
      setRoadmaps((prev) => [res.roadmap, ...prev]);
      setSkill('');
      showToast(
        res.roadmap.ai_mode === 'basic'
          ? 'Roadmap generated (basic mode template).'
          : 'AI learning roadmap generated and saved!',
        'success'
      );
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const toggleMilestone = async (roadmapId: string, milestoneId: string, currentCompleted: boolean) => {
    const next = !currentCompleted;
    setRoadmaps((prev) =>
      prev.map((rm) =>
        rm.id === roadmapId
          ? {
              ...rm,
              milestones: rm.milestones.map((m) => (m.id === milestoneId ? { ...m, completed: next } : m)),
            }
          : rm
      )
    );

    try {
      await apiFetch(`/api/roadmaps/milestones/${milestoneId}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: next }),
      });
    } catch (err) {
      showToast((err as Error).message, 'error');
      loadRoadmaps();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/roadmaps/${deleteTarget.id}`, { method: 'DELETE' });
      setRoadmaps((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      showToast('Roadmap deleted.', 'info');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Generator Form */}
      <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-[#F47735]" />
          <h2 className="font-display font-semibold text-lg text-[#1B2A41]">Generate a Personalized Learning Roadmap</h2>
        </div>
        <p className="text-sm text-[#1B2A41]/70 mb-5">
          Enter your target skill, current level, and weekly hours. Milestones are saved to your account and persist across logins.
        </p>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label htmlFor="rm-skill" className="block text-xs font-medium text-[#1B2A41]/75 mb-1">
              Target Skill
            </label>
            <input
              id="rm-skill"
              type="text"
              required
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="e.g. Python & Data Science"
              className="w-full rounded-lg border border-[#1B2A41]/20 px-3.5 py-2 text-sm"
            />
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="rm-curr" className="block text-xs font-medium text-[#1B2A41]/75 mb-1">
              Current Level
            </label>
            <select
              id="rm-curr"
              value={currentLevel}
              onChange={(e) => setCurrentLevel(e.target.value)}
              className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="rm-target" className="block text-xs font-medium text-[#1B2A41]/75 mb-1">
              Target Level
            </label>
            <select
              id="rm-target"
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value)}
              className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm"
            >
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="rm-hours" className="block text-xs font-medium text-[#1B2A41]/75 mb-1">
              Hours / Week
            </label>
            <input
              id="rm-hours"
              type="number"
              min={1}
              max={40}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
              className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
          <div className="lg:col-span-2">
            <button
              type="submit"
              disabled={generating}
              className="w-full py-2 px-4 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {generating ? 'Building...' : 'Generate Plan'}
            </button>
          </div>
        </form>
      </section>

      {loading && <LoadingSkeleton rows={2} />}
      {!loading && error && <ErrorBanner message={error} onRetry={loadRoadmaps} />}

      {!loading && !error && roadmaps.length === 0 && (
        <EmptyState
          icon={<MapIcon className="w-6 h-6" />}
          title="No roadmaps saved yet"
          description="Generate a structured 4-stage skill plan above to track topics, milestones, and recommended peer sessions."
        />
      )}

      {!loading && !error && roadmaps.length > 0 && (
        <div className="space-y-6">
          {roadmaps.map((rm) => {
            const doneCount = rm.milestones.filter((m) => m.completed).length;
            const total = rm.milestones.length;
            const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

            return (
              <article key={rm.id} className="rounded-xl bg-white border border-[#1B2A41]/10 p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#1B2A41]/10 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-display font-bold text-xl text-[#1B2A41]">{rm.skill_name}</h3>
                      {rm.ai_mode === 'basic' && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#F5F1E8] text-[#1B2A41]/75 border border-[#1B2A41]/12">
                          basic mode
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#1B2A41]/65 capitalize tabular-nums">
                      {rm.current_level} → {rm.target_level} · {rm.weekly_hours} hrs/week · {doneCount}/{total} milestones ({pct}%)
                    </p>
                    <p className="text-sm text-[#1B2A41]/80 pt-1">{rm.summary}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(rm)}
                    aria-label="Delete roadmap"
                    className="p-2 rounded-lg text-[#1B2A41]/45 hover:text-red-600 hover:bg-red-50 self-start"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="h-2 rounded-full bg-[#F5F1E8] overflow-hidden">
                  <div className="h-full bg-[#2CA69A] rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                {/* Stages */}
                <div className="divide-y divide-[#1B2A41]/8">
                  {rm.milestones.map((m) => (
                    <div key={m.id} className="py-4 first:pt-0 last:pb-0 flex items-start gap-3.5">
                      <button
                        type="button"
                        onClick={() => toggleMilestone(rm.id, m.id, m.completed)}
                        aria-label={m.completed ? 'Mark milestone incomplete' : 'Mark milestone complete'}
                        className="mt-0.5 text-[#2CA69A] hover:opacity-80 shrink-0"
                      >
                        {m.completed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-[#1B2A41]/35" />}
                      </button>

                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold text-[#F47735]">{m.week_label}</span>
                          <h4
                            className={`text-sm font-semibold ${
                              m.completed ? 'line-through text-[#1B2A41]/50' : 'text-[#1B2A41]'
                            }`}
                          >
                            {m.title}
                          </h4>
                        </div>
                        <ul className="list-disc list-inside text-xs text-[#1B2A41]/75 space-y-0.5">
                          {m.topics.map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                        <p className="text-xs text-[#1B2A41]/65 pt-0.5">
                          Suggested Session: <strong className="text-[#1B2A41]">{m.suggested_session}</strong> ·{' '}
                          {m.partner_hint}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Learning Roadmap?"
        description={`Remove your "${deleteTarget?.skill_name}" roadmap and all milestone progress?`}
        confirmLabel="Delete Roadmap"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
