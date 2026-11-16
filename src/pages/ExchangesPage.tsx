import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MessageSquare, Calendar, Star, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { ExchangeItem, ExchangeRequestItem } from '../types';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export const ExchangesPage: React.FC = () => {
  const { user, refreshUser, showToast } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'pending' | 'accepted' | 'completed'>('pending');
  const [requests, setRequests] = useState<ExchangeRequestItem[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rejectTarget, setRejectTarget] = useState<ExchangeRequestItem | null>(null);
  const [completeTarget, setCompleteTarget] = useState<ExchangeItem | null>(null);
  const [projectNote, setProjectNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Review modal state
  const [reviewTarget, setReviewTarget] = useState<ExchangeItem | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ requests: ExchangeRequestItem[]; exchanges: ExchangeItem[] }>('/api/exchanges');
      setRequests(res.requests);
      setExchanges(res.exchanges);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRespond = async (requestId: string, action: 'accept' | 'reject') => {
    setBusy(true);
    try {
      await apiFetch(`/api/exchanges/requests/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await refreshUser();
      await loadData();
      showToast(action === 'accept' ? 'Exchange accepted! Start chatting or schedule a session.' : 'Request declined.', 'success');
      if (action === 'accept') setTab('accepted');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
      setRejectTarget(null);
    }
  };

  const handleConfirmComplete = async () => {
    if (!completeTarget) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ status: string }>(`/api/exchanges/${completeTarget.id}/confirm-complete`, {
        method: 'POST',
        body: JSON.stringify({ projectNote }),
      });
      await refreshUser();
      await loadData();
      if (res.status === 'completed') {
        showToast('Exchange completed by both parties! Credits & badges updated.', 'success');
        setTab('completed');
      } else {
        showToast('Your completion is recorded. Waiting for your partner to confirm.', 'info');
      }
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
      setCompleteTarget(null);
      setProjectNote('');
    }
  };

  const handleOpenChat = async (peerId: string) => {
    try {
      const res = await apiFetch<{ conversationId: string }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ peerId }),
      });
      navigate(`/messages?c=${res.conversationId}`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget || !user) return;
    const revieweeId = reviewTarget.teacher_id === user.id ? reviewTarget.learner_id : reviewTarget.teacher_id;
    setBusy(true);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          exchangeId: reviewTarget.id,
          revieweeId,
          rating,
          comment,
        }),
      });
      await loadData();
      showToast('Review published to peer profile!', 'success');
      setReviewTarget(null);
      setComment('');
      setRating(5);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'rejected');
  const acceptedExchanges = exchanges.filter((e) => e.status === 'accepted');
  const completedExchanges = exchanges.filter((e) => e.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#1B2A41]/12 rounded-xl">
          {[
            { key: 'pending', label: `Pending (${requests.filter((r) => r.status === 'pending').length})` },
            { key: 'accepted', label: `Accepted (${acceptedExchanges.length})` },
            { key: 'completed', label: `Completed (${completedExchanges.length})` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap tabular-nums ${
                tab === t.key ? 'bg-[#1B2A41] text-white' : 'text-[#1B2A41]/70 hover:text-[#1B2A41]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate('/explore')}
          className="px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium transition-colors whitespace-nowrap"
        >
          + New Request
        </button>
      </div>

      {loading && <LoadingSkeleton rows={3} />}
      {!loading && error && <ErrorBanner message={error} onRetry={loadData} />}

      {/* Pending Tab */}
      {!loading && !error && tab === 'pending' && (
        <>
          {pendingRequests.length === 0 ? (
            <EmptyState
              title="No pending requests"
              description="Browse Explore Skills or AI Matches to propose a skill swap or credit session."
              actionLabel="Explore Peers"
              onAction={() => navigate('/explore')}
            />
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => {
                const isIncoming = req.receiver_id === user.id;
                return (
                  <article
                    key={req.id}
                    className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-semibold text-[#2CA69A]">
                          {isIncoming ? 'Incoming Request' : 'Sent Request'}
                        </span>
                        <span aria-hidden="true" className="text-[#1B2A41]/30">·</span>
                        <span className="text-xs font-medium capitalize text-[#1B2A41]/70">
                          Status: {req.status}
                        </span>
                        <span aria-hidden="true" className="text-[#1B2A41]/30">·</span>
                        <span className="text-xs font-mono text-[#1B2A41]/70 tabular-nums">
                          {req.mode === 'swap' ? 'Two-Way Swap' : `Credit (${req.credit_cost} Cr)`} · {req.duration_minutes} min
                        </span>
                      </div>

                      <h3 className="font-display font-semibold text-base text-[#1B2A41]">
                        {isIncoming ? `${req.sender_name} → You` : `You → ${req.receiver_name}`}: {req.requested_skill_name}
                        {req.offered_skill_name ? ` ⇄ ${req.offered_skill_name}` : ''}
                      </h3>
                      <p className="text-xs text-[#1B2A41]/65">
                        Method: {req.preferred_method} {req.proposed_date ? `· Proposed date: ${req.proposed_date}` : ''}
                      </p>
                      {req.message && (
                        <p className="text-sm text-[#1B2A41]/80 pt-1">“{req.message}”</p>
                      )}
                    </div>

                    {isIncoming && req.status === 'pending' && (
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setRejectTarget(req)}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespond(req.id, 'accept')}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg bg-[#2CA69A] hover:bg-[#21857B] text-white text-xs font-medium transition-colors"
                        >
                          Accept Exchange
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Accepted Tab */}
      {!loading && !error && tab === 'accepted' && (
        <>
          {acceptedExchanges.length === 0 ? (
            <EmptyState
              title="No active exchanges"
              description="Accept an incoming request or wait for a peer to accept yours to begin."
              actionLabel="Check Pending"
              onAction={() => setTab('pending')}
            />
          ) : (
            <div className="space-y-4">
              {acceptedExchanges.map((ex) => {
                const isTeacher = ex.teacher_id === user.id;
                const partnerId = isTeacher ? ex.learner_id : ex.teacher_id;
                const partnerName = isTeacher ? ex.learner_name : ex.teacher_name;
                const myConfirmed = isTeacher ? ex.teacher_confirmed : ex.learner_confirmed;
                const partnerConfirmed = isTeacher ? ex.learner_confirmed : ex.teacher_confirmed;

                return (
                  <article
                    key={ex.id}
                    className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <p className="text-xs text-[#1B2A41]/65 tabular-nums">
                        {ex.mode === 'swap' ? 'Two-Way Swap' : `Credit Learning (${ex.credit_amount} Cr)`} ·{' '}
                        {ex.duration_minutes} min · Teacher: <strong>{ex.teacher_name}</strong> · Learner:{' '}
                        <strong>{ex.learner_name}</strong>
                      </p>
                      <h3 className="font-display font-semibold text-base text-[#1B2A41]">
                        {ex.skill_taught_name}
                        {ex.skill_learned_name ? ` ⇄ ${ex.skill_learned_name}` : ''}
                      </h3>
                      <div className="flex items-center gap-4 text-xs pt-1">
                        <span className={myConfirmed ? 'text-[#2CA69A] font-medium' : 'text-[#1B2A41]/60'}>
                          {myConfirmed ? '✓ You confirmed completion' : '· Awaiting your confirmation'}
                        </span>
                        <span className={partnerConfirmed ? 'text-[#2CA69A] font-medium' : 'text-[#1B2A41]/60'}>
                          {partnerConfirmed ? `✓ ${partnerName} confirmed` : `· Awaiting ${partnerName}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenChat(partnerId)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1B2A41]/15 text-xs font-medium text-[#1B2A41] hover:bg-[#F5F1E8]"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/schedule?exchange=${ex.id}&partner=${partnerId}`)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#1B2A41]/15 text-xs font-medium text-[#1B2A41] hover:bg-[#F5F1E8]"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Schedule
                      </button>
                      <button
                        type="button"
                        disabled={myConfirmed}
                        onClick={() => setCompleteTarget(ex)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-xs font-medium disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {myConfirmed ? 'Confirmed' : 'Complete Exchange'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Completed Tab */}
      {!loading && !error && tab === 'completed' && (
        <>
          {completedExchanges.length === 0 ? (
            <EmptyState
              title="No completed exchanges yet"
              description="Once both you and your partner confirm an accepted exchange, it appears here with earned credits and review access."
            />
          ) : (
            <div className="space-y-4">
              {completedExchanges.map((ex) => {
                const isTeacher = ex.teacher_id === user.id;
                const partnerName = isTeacher ? ex.learner_name : ex.teacher_name;
                return (
                  <article
                    key={ex.id}
                    className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-[#2CA69A] font-medium tabular-nums">
                        Completed · {ex.mode === 'swap' ? 'Two-Way Swap' : `${ex.credit_amount} Credit(s) settled`} ·{' '}
                        {ex.duration_minutes} min
                      </p>
                      <h3 className="font-display font-semibold text-base text-[#1B2A41]">
                        {ex.skill_taught_name}
                        {ex.skill_learned_name ? ` ⇄ ${ex.skill_learned_name}` : ''} with {partnerName}
                      </h3>
                      <p className="text-xs text-[#1B2A41]/65">
                        Teacher: {ex.teacher_name} · Learner: {ex.learner_name}
                        {ex.project_note ? ` · Note: ${ex.project_note}` : ''}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {ex.user_has_reviewed ? (
                        <span className="text-xs font-medium text-[#2CA69A]">✓ Review Submitted</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReviewTarget(ex)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B2A41] hover:bg-[#263A57] text-white text-xs font-medium"
                        >
                          <Star className="w-3.5 h-3.5 text-[#F47735]" />
                          Leave Review
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Reject Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Reject Exchange Request?"
        description={`Are you sure you want to decline ${rejectTarget?.sender_name}'s request for ${rejectTarget?.requested_skill_name}? This cannot be undone.`}
        confirmLabel="Yes, Reject Request"
        tone="danger"
        busy={busy}
        onConfirm={() => rejectTarget && handleRespond(rejectTarget.id, 'reject')}
        onCancel={() => setRejectTarget(null)}
      />

      {/* Complete Exchange Confirmation Dialog */}
      {completeTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2A41]/50 backdrop-blur-[2px] p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white border border-[#1B2A41]/12 shadow-xl p-6 space-y-4">
            <h2 className="font-display font-semibold text-lg text-[#1B2A41]">Confirm Exchange Completion</h2>
            <p className="text-sm text-[#1B2A41]/75">
              Credits and badges are released only after both parties confirm completion.
              {completeTarget.mode === 'credit'
                ? ` Settling ${completeTarget.credit_amount} credit(s) between ${completeTarget.learner_name} and ${completeTarget.teacher_name}.`
                : ''}
            </p>
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1">
                Project / Learning Takeaway (optional, saved to Skill Passport)
              </label>
              <input
                type="text"
                value={projectNote}
                onChange={(e) => setProjectNote(e.target.value)}
                placeholder="e.g. Built responsive Flexbox grid & practiced 3 chord patterns"
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCompleteTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmComplete}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white"
              >
                {busy ? 'Confirming...' : 'Confirm Completion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2A41]/50 backdrop-blur-[2px] p-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white border border-[#1B2A41]/12 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg text-[#1B2A41]">Rate Your Exchange Partner</h2>
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="p-1.5 rounded-lg text-[#1B2A41]/50 hover:bg-[#F5F1E8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-2">Star Rating (1–5)</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1"
                      aria-label={`${star} stars`}
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= rating ? 'text-[#F47735] fill-[#F47735]' : 'text-[#1B2A41]/20'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-mono tabular-nums text-[#1B2A41]">{rating}/5</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">Peer Feedback</label>
                <textarea
                  rows={3}
                  required
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What went well during this exchange?"
                  className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReviewTarget(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#2CA69A] hover:bg-[#21857B] text-white"
                >
                  {busy ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
