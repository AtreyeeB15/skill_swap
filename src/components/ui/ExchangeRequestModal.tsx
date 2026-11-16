import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { UserProfile } from '../../types';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ExchangeRequestModalProps {
  open: boolean;
  peer: UserProfile | null;
  onClose: () => void;
  onSent: () => void;
}

export const ExchangeRequestModal: React.FC<ExchangeRequestModalProps> = ({ open, peer, onClose, onSent }) => {
  const { user, showToast, refreshUser } = useAuth();
  const [mode, setMode] = useState<'swap' | 'credit'>('swap');
  const [requestedSkillId, setRequestedSkillId] = useState('');
  const [offeredSkillId, setOfferedSkillId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [preferredMethod, setPreferredMethod] = useState<'online' | 'in-person' | 'chat'>('online');
  const [proposedDate, setProposedDate] = useState(() => {
    const d = new Date(Date.now() + 86400000 * 2);
    return d.toISOString().slice(0, 10);
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (peer && open) {
      setRequestedSkillId(peer.teachSkills[0]?.skill_id || '');
      setOfferedSkillId(user?.teachSkills[0]?.skill_id || '');
      setMode(user?.teachSkills.length ? 'swap' : 'credit');
      setPreferredMethod(peer.preferred_method || 'online');
      setDurationMinutes(30);
      setMessage('');
      setError('');
    }
  }, [peer, open, user]);

  if (!open || !peer || !user) return null;

  const ratePer30 = peer.credits_per_30min || 1;
  const creditCost = mode === 'credit' ? Math.max(1, Math.ceil(durationMinutes / 30) * ratePer30) : 0;
  const insufficientCredits = mode === 'credit' && user.wallet.balance < creditCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!requestedSkillId) {
      setError('Please select a skill you want to learn from this peer.');
      return;
    }
    if (mode === 'swap' && !offeredSkillId) {
      setError('Select one of your teachable skills for a two-way swap, or switch to Credit mode.');
      return;
    }
    if (insufficientCredits) {
      setError(`You need ${creditCost} credits, but your balance is ${user.wallet.balance}.`);
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/exchanges/requests', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: peer.id,
          requestedSkillId,
          offeredSkillId: mode === 'swap' ? offeredSkillId : null,
          mode,
          durationMinutes,
          preferredMethod,
          proposedDate,
          message,
        }),
      });
      await refreshUser();
      showToast(`Exchange request sent to ${peer.name}.`, 'success');
      onSent();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exchange-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2A41]/50 backdrop-blur-[2px] p-4"
    >
      <div className="w-full max-w-lg rounded-xl bg-white border border-[#1B2A41]/12 shadow-xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 border-b border-[#1B2A41]/10 pb-4">
          <div>
            <h2 id="exchange-modal-title" className="text-lg font-semibold text-[#1B2A41]">
              Request Exchange with {peer.name}
            </h2>
            <p className="text-xs text-[#1B2A41]/65 mt-0.5">
              Choose a direct two-way skill swap or learn with credits ({ratePer30} credit / 30 min).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#1B2A41]/50 hover:text-[#1B2A41] hover:bg-[#F5F1E8]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">Exchange Mode</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F5F1E8] rounded-lg">
              <button
                type="button"
                onClick={() => setMode('swap')}
                className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === 'swap' ? 'bg-white text-[#1B2A41] shadow-sm' : 'text-[#1B2A41]/70 hover:text-[#1B2A41]'
                }`}
              >
                Two-Way Swap (0 Credits)
              </button>
              <button
                type="button"
                onClick={() => setMode('credit')}
                className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === 'credit' ? 'bg-white text-[#1B2A41] shadow-sm' : 'text-[#1B2A41]/70 hover:text-[#1B2A41]'
                }`}
              >
                Credit Learning ({creditCost} Cr)
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="req-skill" className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">
              Skill you want to learn from {peer.name}
            </label>
            <select
              id="req-skill"
              value={requestedSkillId}
              onChange={(e) => setRequestedSkillId(e.target.value)}
              className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2.5 text-sm text-[#1B2A41] focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
            >
              {peer.teachSkills.length === 0 && <option value="">No teachable skills listed</option>}
              {peer.teachSkills.map((s) => (
                <option key={s.id} value={s.skill_id}>
                  {s.name} ({s.proficiency})
                </option>
              ))}
            </select>
          </div>

          {mode === 'swap' && (
            <div>
              <label htmlFor="off-skill" className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">
                Skill you will teach in return
              </label>
              <select
                id="off-skill"
                value={offeredSkillId}
                onChange={(e) => setOfferedSkillId(e.target.value)}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2.5 text-sm text-[#1B2A41] focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
              >
                {user.teachSkills.length === 0 && (
                  <option value="">Add a teachable skill in My Profile first</option>
                )}
                {user.teachSkills.map((s) => (
                  <option key={s.id} value={s.skill_id}>
                    {s.name} ({s.proficiency})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="req-duration" className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">
                Duration
              </label>
              <select
                id="req-duration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2.5 text-sm tabular-nums text-[#1B2A41]"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>

            <div>
              <label htmlFor="req-method" className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">
                Method
              </label>
              <select
                id="req-method"
                value={preferredMethod}
                onChange={(e) => setPreferredMethod(e.target.value as any)}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2.5 text-sm text-[#1B2A41]"
              >
                <option value="online">Online</option>
                <option value="in-person">In-Person</option>
                <option value="chat">Chat</option>
              </select>
            </div>

            <div>
              <label htmlFor="req-date" className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">
                Proposed Date
              </label>
              <input
                id="req-date"
                type="date"
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm tabular-nums text-[#1B2A41]"
              />
            </div>
          </div>

          {mode === 'credit' && (
            <div
              className={`rounded-lg px-3.5 py-2.5 text-xs flex items-center justify-between ${
                insufficientCredits
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-[#F5F1E8] text-[#1B2A41]'
              }`}
            >
              <span>
                Cost settled only after both confirm completion: <strong className="tabular-nums">{creditCost} credit(s)</strong>
              </span>
              <span className="font-mono tabular-nums">Your balance: {user.wallet.balance}</span>
            </div>
          )}

          <div>
            <label htmlFor="req-msg" className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">
              Note to {peer.name}
            </label>
            <textarea
              id="req-msg"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share what you'd like to focus on and your preferred times..."
              className="w-full rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm text-[#1B2A41] focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
            />
          </div>

          {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[#1B2A41]/15 text-[#1B2A41] hover:bg-[#F5F1E8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || insufficientCredits || peer.teachSkills.length === 0}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white transition-colors disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
