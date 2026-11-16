import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, SlidersHorizontal } from 'lucide-react';
import { apiFetch } from '../services/api';
import { UserProfile } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';
import { ExchangeRequestModal } from '../components/ui/ExchangeRequestModal';

export const ExplorePage: React.FC = () => {
  const [peers, setPeers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [proficiency, setProficiency] = useState('');
  const [availability, setAvailability] = useState('');
  const [method, setMethod] = useState('');

  const [selectedPeer, setSelectedPeer] = useState<UserProfile | null>(null);

  const loadPeers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (proficiency) params.set('proficiency', proficiency);
      if (availability) params.set('availability', availability);
      if (method) params.set('method', method);
      const res = await apiFetch<{ peers: UserProfile[] }>(`/api/explore?${params.toString()}`);
      setPeers(res.peers);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, proficiency, availability, method]);

  useEffect(() => {
    const t = window.setTimeout(loadPeers, 180);
    return () => window.clearTimeout(t);
  }, [loadPeers]);

  const resetFilters = () => {
    setQuery('');
    setProficiency('');
    setAvailability('');
    setMethod('');
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-[#1B2A41]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills, names, or topics (e.g. Python, Guitar)..."
              className="w-full rounded-lg border border-[#1B2A41]/20 pl-9 pr-3.5 py-2 text-sm text-[#1B2A41] focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by proficiency"
              value={proficiency}
              onChange={(e) => setProficiency(e.target.value)}
              className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm text-[#1B2A41]"
            >
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm text-[#1B2A41]"
            >
              <option value="">Any Day</option>
              <option value="Mon">Monday</option>
              <option value="Tue">Tuesday</option>
              <option value="Wed">Wednesday</option>
              <option value="Thu">Thursday</option>
              <option value="Fri">Friday</option>
              <option value="Sat">Saturday</option>
              <option value="Sun">Sunday</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Filter by method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm text-[#1B2A41]"
            >
              <option value="">All Methods</option>
              <option value="online">Online</option>
              <option value="in-person">In-Person</option>
              <option value="chat">Chat</option>
            </select>
          </div>

          <div className="lg:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              title="Reset filters"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[#1B2A41]/15 text-xs font-medium text-[#1B2A41]/80 hover:bg-[#F5F1E8] whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </section>

      {loading && <LoadingSkeleton rows={3} />}
      {!loading && error && <ErrorBanner message={error} onRetry={loadPeers} />}

      {!loading && !error && peers.length === 0 && (
        <EmptyState
          title="No matching peers found"
          description="Try broadening your search keywords or clearing availability and proficiency filters."
          actionLabel="Clear Filters"
          onAction={resetFilters}
        />
      )}

      {!loading && !error && peers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {peers.map((peer) => (
            <article
              key={peer.id}
              className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 flex flex-col justify-between gap-4 hover:border-[#1B2A41]/25 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3.5">
                  <Avatar name={peer.name} src={peer.avatar_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/peers/${peer.id}`}
                      className="font-display font-semibold text-base text-[#1B2A41] hover:text-[#F47735] truncate block"
                    >
                      {peer.name}
                    </Link>
                    <p className="text-xs text-[#1B2A41]/65 mt-0.5 flex items-center gap-1.5 flex-wrap tabular-nums">
                      <span className="inline-flex items-center gap-0.5 text-[#1B2A41] font-medium">
                        <Star className="w-3 h-3 text-[#F47735] fill-[#F47735]" />
                        {peer.reviewCount > 0 ? peer.avgRating : 'New'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{peer.preferred_method}</span>
                      <span aria-hidden="true">·</span>
                      <span>{peer.credits_per_30min} cr / 30m</span>
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#1B2A41]/75 line-clamp-2 leading-relaxed">{peer.bio}</p>

                <div className="pt-2 border-t border-[#1B2A41]/8 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-[#2CA69A]">Teaches: </span>
                    <span className="text-[#1B2A41]">
                      {peer.teachSkills.map((s) => `${s.name} (${s.proficiency})`).join(', ') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#F47735]">Wants: </span>
                    <span className="text-[#1B2A41]">
                      {peer.learnSkills.map((s) => s.name).join(', ') || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#1B2A41]/60">Available: </span>
                    <span className="text-[#1B2A41]/80">{peer.weekly_availability.join(', ') || 'Flexible'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#1B2A41]/8 flex items-center justify-between gap-2">
                <Link
                  to={`/peers/${peer.id}`}
                  className="px-3.5 py-2 rounded-lg border border-[#1B2A41]/15 text-xs font-medium text-[#1B2A41] hover:bg-[#F5F1E8] transition-colors whitespace-nowrap"
                >
                  View Profile
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedPeer(peer)}
                  className="px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-xs font-medium transition-colors whitespace-nowrap"
                >
                  Request Exchange
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ExchangeRequestModal
        open={Boolean(selectedPeer)}
        peer={selectedPeer}
        onClose={() => setSelectedPeer(null)}
        onSent={loadPeers}
      />
    </div>
  );
};
