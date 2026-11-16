import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-4" aria-busy="true" aria-label="Loading content">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl bg-white border border-[#1B2A41]/10 p-5 animate-pulse space-y-3"
      >
        <div className="h-4 w-1/3 bg-[#1B2A41]/10 rounded" />
        <div className="h-3 w-2/3 bg-[#1B2A41]/8 rounded" />
        <div className="h-3 w-1/2 bg-[#1B2A41]/6 rounded" />
      </div>
    ))}
  </div>
);

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="rounded-xl bg-white border border-[#1B2A41]/10 p-10 text-center max-w-lg mx-auto">
    {icon && (
      <div className="w-12 h-12 rounded-xl bg-[#F5F1E8] text-[#1B2A41]/70 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
    )}
    <h3 className="text-base font-semibold text-[#1B2A41]">{title}</h3>
    <p className="mt-1.5 text-sm text-[#1B2A41]/70 leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium transition-colors whitespace-nowrap"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div
    role="alert"
    className="rounded-xl bg-red-50 border border-red-200 px-4 py-3.5 flex items-center justify-between gap-4 text-red-900"
  >
    <div className="flex items-center gap-3 text-sm">
      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
      <span>{message}</span>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors whitespace-nowrap shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry
      </button>
    )}
  </div>
);
