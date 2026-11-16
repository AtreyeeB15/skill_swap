import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Sparkles } from 'lucide-react';
import { apiFetch } from '../services/api';
import { PeerMatch, UserProfile } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';
import { ExchangeRequestModal } from '../components/ui/ExchangeRequestModal';

export const MatchesPage: React.FC = () => {
  const [matches, setMatches] = useState<PeerMatch[]>([]);
  const [mode, setMode] = useState<'gemini' | 'basic'>('gemini');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connectPeer, setConnectPeer] = useState<UserProfile | null>(null);
  const navigate = useNavigate();

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ mode: 'gemini' | 'basic'; matches: PeerMatch[] }>('/api/matches');
      setMode(res.mode);
      setMatches(res.matches);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#F47735]" />
            <h2 className="font-display font-semibold text-lg text-[#1B2A41]">
              Personalized Peer Compatibility
            </h2>
            {!loading && mode === 'basic' && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#F5F1E8] text-[#1B2A41]/75 border border-[#1B2A41]/12">
                basic mode
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#1B2A41]/70">
            Ranked by mutual teach/learn skill fit, weekly availability overlap, preferred method, and proficiency.
          </p>
        </div>
        <button
          type="button"
          onClick={loadMatches}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1B2A41]/20 bg-white hover:bg-[#F5F1E8] text-xs font-medium text-[#1B2A41] transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Recalculate Matches</span>
        </button>
      </section>

      {loading && <LoadingSkeleton rows={4} />}
      {!loading && error && <ErrorBanner message={error} onRetry={loadMatches} />}

      {!loading && !error && matches.length === 0 && (
        <EmptyState
          title="No matches generated yet"
          description="Add skills you can teach and skills you want to learn in your profile to calculate compatibility scores."
          actionLabel="Update Skills"
          onAction={() => navigate('/profile')}
        />
      )}

      {!loading && !error && matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {matches.map((peer) => (
            <article
              key={peer.id}
              className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 sm:p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar name={peer.name} src={peer.avatar_url} size="md" />
                    <div className="min-w-0">
                      <Link
                        to={`/peers/${peer.id}`}
                        className="font-display font-semibold text-base text-[#1B2A41] hover:text-[#F47735] truncate block"
                      >
                        {peer.name}
                      </Link>
                      <p className="text-xs text-[#1B2A41]/65 capitalize">
                        {peer.preferred_method} · {peer.weekly_availability.slice(0, 3).join(', ') || 'Flexible'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-display font-bold text-xl text-[#2CA69A] tabular-nums">
                      {peer.matchScore}%
                    </span>
                    <p className="text-[11px] text-[#1B2A41]/55">Match</p>
                  </div>
                </div>

                <p className="text-sm text-[#1B2A41]/85 leading-relaxed bg-[#F5F1E8]/60 rounded-lg px-3.5 py-2.5">
                  {peer.why}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <p className="font-semibold text-[#2CA69A] mb-1">Offers to Teach</p>
                    <p className="text-[#1B2A41]">
                      {peer.teachSkills.map((s) => `${s.name} (${s.proficiency})`).join(', ') || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#F47735] mb-1">Wants to Learn</p>
                    <p className="text-[#1B2A41]">
                      {peer.learnSkills.map((s) => s.name).join(', ') || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1B2A41]/8 flex items-center justify-between gap-3">
                <Link
                  to={`/peers/${peer.id}`}
                  className="text-xs font-medium text-[#1B2A41]/80 hover:text-[#1B2A41] hover:underline"
                >
                  Inspect Full Profile →
                </Link>
                <button
                  type="button"
                  onClick={() => setConnectPeer(peer)}
                  className="px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-xs font-medium transition-colors whitespace-nowrap"
                >
                  Connect
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ExchangeRequestModal
        open={Boolean(connectPeer)}
        peer={connectPeer}
        onClose={() => setConnectPeer(null)}
        onSent={loadMatches}
      />
    </div>
  );
};
