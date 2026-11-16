import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState } from '../components/ui/StateViews';

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();

  const visible = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#1B2A41]/12 rounded-xl">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filter === 'all' ? 'bg-[#1B2A41] text-white' : 'text-[#1B2A41]/70'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium tabular-nums ${
              filter === 'unread' ? 'bg-[#1B2A41] text-white' : 'text-[#1B2A41]/70'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1B2A41]/20 bg-white hover:bg-[#F5F1E8] text-xs font-medium text-[#1B2A41]"
          >
            <CheckCheck className="w-4 h-4 text-[#2CA69A]" />
            Mark all as read
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-6 h-6" />}
          title={filter === 'unread' ? 'All caught up' : 'No notifications yet'}
          description="Exchange requests, acceptances, messages, sessions, credit updates, reviews, and circle invites appear here."
        />
      ) : (
        <div className="rounded-xl bg-white border border-[#1B2A41]/10 divide-y divide-[#1B2A41]/8 overflow-hidden">
          {visible.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                markNotificationRead(n.id);
                navigate(n.link || '/dashboard');
              }}
              className={`w-full text-left px-5 py-4 hover:bg-[#F5F1E8]/50 transition-colors flex items-start justify-between gap-4 ${
                !n.is_read ? 'bg-[#F5F1E8]/35' : ''
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#1B2A41]">{n.title}</span>
                  {!n.is_read && <span className="text-xs font-medium text-[#F47735]">Unread</span>}
                </div>
                <p className="text-xs text-[#1B2A41]/75 leading-relaxed">{n.body}</p>
              </div>
              <span className="text-[11px] font-mono text-[#1B2A41]/55 shrink-0 tabular-nums">
                {new Date(n.created_at).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
