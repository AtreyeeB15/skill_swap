import React, { useEffect, useState, useCallback } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { apiFetch } from '../services/api';
import { CreditTransaction, CreditWallet } from '../types';
import { useAuth } from '../context/AuthContext';
import { LoadingSkeleton, ErrorBanner, EmptyState } from '../components/ui/StateViews';

export const WalletPage: React.FC = () => {
  const { refreshUser, showToast } = useAuth();
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingRate, setSavingRate] = useState(false);
  const [error, setError] = useState('');

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{
        wallet: CreditWallet;
        credits_per_30min: number;
        transactions: CreditTransaction[];
      }>('/api/wallet');
      setWallet(res.wallet);
      setRate(res.credits_per_30min);
      setTransactions(res.transactions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRate(true);
    try {
      await apiFetch('/api/wallet/rate', {
        method: 'PATCH',
        body: JSON.stringify({ credits_per_30min: rate }),
      });
      await refreshUser();
      showToast(`Teaching rate set to ${rate} credit(s) per 30 min.`, 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSavingRate(false);
    }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error) return <ErrorBanner message={error} onRetry={loadWallet} />;
  if (!wallet) return null;

  return (
    <div className="space-y-6">
      {/* Balance + Rate Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 rounded-xl bg-[#1B2A41] text-white p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#F5F1E8]/70">Available Balance</p>
              <p className="mt-1 font-display font-bold text-4xl text-white tabular-nums">
                {wallet.balance} <span className="text-lg font-normal text-[#F5F1E8]/75">credits</span>
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-[#2CA69A]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/12 text-xs">
            <div>
              <span className="text-[#F5F1E8]/65">Total Earned</span>
              <p className="font-mono font-semibold text-base text-[#2CA69A] tabular-nums mt-0.5">
                +{wallet.total_earned}
              </p>
            </div>
            <div>
              <span className="text-[#F5F1E8]/65">Total Spent</span>
              <p className="font-mono font-semibold text-base text-[#F47735] tabular-nums mt-0.5">
                -{wallet.total_spent}
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl bg-white border border-[#1B2A41]/10 p-6">
          <h2 className="font-display font-semibold text-base text-[#1B2A41]">Session Credit Rate</h2>
          <p className="mt-1 text-xs text-[#1B2A41]/65 leading-relaxed">
            Credits are awarded idempotently only after both parties confirm an exchange is completed.
          </p>
          <form onSubmit={handleSaveRate} className="mt-4 flex items-end gap-3">
            <div>
              <label htmlFor="wallet-rate" className="block text-xs font-medium text-[#1B2A41]/75 mb-1">
                Credits / 30 min
              </label>
              <input
                id="wallet-rate"
                type="number"
                min={1}
                max={10}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-24 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
            <button
              type="submit"
              disabled={savingRate}
              className="px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium transition-colors"
            >
              {savingRate ? 'Saving...' : 'Update Rate'}
            </button>
          </form>
        </section>
      </div>

      {/* Immutable Ledger Table */}
      <section className="rounded-xl bg-white border border-[#1B2A41]/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1B2A41]/10">
          <h3 className="font-display font-semibold text-base text-[#1B2A41]">Credit Ledger History</h3>
        </div>

        {transactions.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No transactions yet" description="Your credit grants, earnings, and spends will appear here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1B2A41]/10 text-xs font-medium text-[#1B2A41]/60 bg-[#F5F1E8]/50">
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-6 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B2A41]/8 text-sm">
                {transactions.map((tx) => {
                  const positive = tx.amount >= 0;
                  return (
                    <tr key={tx.id} className="hover:bg-[#F5F1E8]/35">
                      <td className="py-3 px-6 text-xs text-[#1B2A41]/65 font-mono tabular-nums whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium capitalize text-[#1B2A41] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          {positive ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-[#2CA69A]" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#F47735]" />
                          )}
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#1B2A41]/85">{tx.description}</td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-semibold tabular-nums whitespace-nowrap ${
                          positive ? 'text-[#2CA69A]' : 'text-[#F47735]'
                        }`}
                      >
                        {positive ? `+${tx.amount}` : tx.amount}
                      </td>
                      <td className="py-3 px-6 text-right font-mono tabular-nums text-[#1B2A41] whitespace-nowrap">
                        {tx.balance_after}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
