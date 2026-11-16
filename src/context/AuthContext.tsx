import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from '../services/api';
import { MessageItem, NotificationItem, UserProfile } from '../types';

interface ToastState {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (name: string, email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  toast: ToastState | null;
  showToast: (message: string, variant?: 'success' | 'error' | 'info') => void;
  dismissToast: () => void;
  subscribeToMessages: (cb: (msg: MessageItem) => void) => () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const messageListenersRef = React.useRef<Set<(msg: MessageItem) => void>>(new Set());

  const showToast = useCallback((message: string, variant: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToast({ id, message, variant });
    window.setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4200);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(data.notifications);
    } catch {
      // ignore if unauthenticated
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: UserProfile }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
      setStoredToken(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch<{ user: UserProfile }>('/api/auth/me');
        if (mounted) {
          setUser(data.user);
          await refreshNotifications();
        }
      } catch {
        if (mounted) {
          setUser(null);
          setStoredToken(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshNotifications]);

  // Realtime SSE stream for messages and notifications
  useEffect(() => {
    if (!user) return;
    const token = getStoredToken();
    const url = token ? `/api/realtime/stream?token=${encodeURIComponent(token)}` : '/api/realtime/stream';
    const es = new EventSource(url);

    es.addEventListener('notification', (ev) => {
      try {
        const notif = JSON.parse((ev as MessageEvent).data) as NotificationItem;
        setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
        refreshUser();
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse((ev as MessageEvent).data) as MessageItem;
        for (const listener of messageListenersRef.current) {
          listener(msg);
        }
      } catch {
        // ignore parse errors
      }
    });

    return () => {
      es.close();
    };
  }, [user?.id, refreshUser]);

  const subscribeToMessages = useCallback((cb: (msg: MessageItem) => void) => {
    messageListenersRef.current.add(cb);
    return () => {
      messageListenersRef.current.delete(cb);
    };
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    await refreshNotifications();
    return data.user;
  };

  const register = async (name: string, email: string, password: string): Promise<UserProfile> => {
    const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    await refreshNotifications();
    return data.user;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredToken(null);
    setUser(null);
    setNotifications([]);
  };

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        notifications,
        unreadCount,
        login,
        register,
        logout,
        refreshUser,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        toast,
        showToast,
        dismissToast,
        subscribeToMessages,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
