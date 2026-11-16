import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  Sparkles,
  ArrowLeftRight,
  MessageSquare,
  Calendar,
  Users,
  Zap,
  Map,
  Award,
  Wallet,
  User,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui/Avatar';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/explore', label: 'Explore Skills', icon: Compass },
  { to: '/matches', label: 'AI Matches', icon: Sparkles },
  { to: '/exchanges', label: 'My Exchanges', icon: ArrowLeftRight },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/schedule', label: 'Schedule', icon: Calendar },
  { to: '/circles', label: 'Group Skill Circles', icon: Users },
  { to: '/micro-sessions', label: 'Micro-Skill Sessions', icon: Zap },
  { to: '/roadmap', label: 'Learning Roadmap', icon: Map },
  { to: '/passport', label: 'Skill Passport', icon: Award },
  { to: '/wallet', label: 'Credit Wallet', icon: Wallet },
  { to: '/profile', label: 'My Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/explore': 'Explore Skills',
  '/matches': 'AI Matches',
  '/exchanges': 'My Exchanges',
  '/messages': 'Messages',
  '/schedule': 'Schedule',
  '/circles': 'Group Skill Circles',
  '/micro-sessions': 'Micro-Skill Sessions',
  '/roadmap': 'Learning Roadmap',
  '/passport': 'Skill Passport',
  '/wallet': 'Credit Wallet',
  '/profile': 'My Profile',
  '/settings': 'Settings',
  '/notifications': 'Notifications',
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    logout,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    toast,
    dismissToast,
  } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = PAGE_TITLES[location.pathname] || (location.pathname.startsWith('/peers/') ? 'Peer Profile' : 'SkillSwap');

  useEffect(() => {
    setDrawerOpen(false);
    setBellOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  if (!user) return null;

  const SidebarNav = (
    <div className="flex flex-col h-full bg-[#1B2A41] text-[#F5F1E8]">
      <div className="px-5 py-5 border-b border-white/10">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#F47735] flex items-center justify-center font-display font-bold text-white text-sm shrink-0">
            S
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white whitespace-nowrap">
            SkillSwap
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white/12 text-white'
                    : 'text-[#F5F1E8]/75 hover:bg-white/6 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#F5F1E8]/75 hover:bg-white/8 hover:text-white transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F5F1E8] text-[#1B2A41]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30 border-r border-[#1B2A41]/15">
        {SidebarNav}
      </aside>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#1B2A41]/55"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[82vw] h-full z-10 shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-3 p-2 rounded-lg text-white/75 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            {SidebarNav}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#1B2A41]/10 px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-[#1B2A41] hover:bg-[#F5F1E8]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display font-semibold text-base sm:text-lg text-[#1B2A41] truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              to="/wallet"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5F1E8] hover:bg-[#EAE2D0] text-xs font-medium text-[#1B2A41] transition-colors whitespace-nowrap tabular-nums"
            >
              <Wallet className="w-3.5 h-3.5 text-[#2CA69A]" />
              <span>{user.wallet.balance} credits</span>
            </Link>

            {/* Notifications Bell */}
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={() => setBellOpen((o) => !o)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-[#1B2A41]/80 hover:text-[#1B2A41] hover:bg-[#F5F1E8] transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#F47735] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-[#1B2A41]/12 shadow-xl overflow-hidden z-40">
                  <div className="px-4 py-3 border-b border-[#1B2A41]/10 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#1B2A41]">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-xs font-medium text-[#2CA69A] hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#1B2A41]/8">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-center text-[#1B2A41]/60">
                        You have no notifications yet.
                      </p>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(n.id);
                            setBellOpen(false);
                            navigate(n.link || '/notifications');
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-[#F5F1E8]/60 transition-colors ${
                            !n.is_read ? 'bg-[#F5F1E8]/40' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#1B2A41] truncate">{n.title}</span>
                            {!n.is_read && <span className="text-[11px] font-medium text-[#F47735] shrink-0">New</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-[#1B2A41]/70 line-clamp-2">{n.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <Link
                    to="/notifications"
                    className="block text-center px-4 py-2.5 text-xs font-medium text-[#1B2A41] bg-[#F5F1E8]/70 hover:bg-[#F5F1E8] border-t border-[#1B2A41]/10"
                  >
                    View all notifications
                  </Link>
                </div>
              )}
            </div>

            <Link to="/profile" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <Avatar name={user.name} src={user.avatar_url} size="sm" />
              <span className="hidden md:inline text-sm font-medium text-[#1B2A41] max-w-[140px] truncate">
                {user.name}
              </span>
            </Link>
          </div>
        </header>

        {/* Global Toast */}
        {toast && (
          <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 max-w-sm">
            <div
              role="status"
              className={`rounded-xl px-4 py-3 shadow-lg border flex items-center gap-3 text-sm ${
                toast.variant === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-[#1B2A41] border-[#1B2A41] text-white'
              }`}
            >
              {toast.variant === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#2CA69A] shrink-0" />
              )}
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={dismissToast}
                aria-label="Dismiss message"
                className="opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Compact Mobile Bottom Nav (<= 15% height) */}
      <nav
        aria-label="Mobile Quick Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-white border-t border-[#1B2A41]/12 grid grid-cols-5"
      >
        {[
          { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
          { to: '/explore', label: 'Explore', icon: Compass },
          { to: '/exchanges', label: 'Exchanges', icon: ArrowLeftRight },
          { to: '/messages', label: 'Chat', icon: MessageSquare },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-[#F47735]' : 'text-[#1B2A41]/70'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[#1B2A41]/70"
        >
          <Menu className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};
