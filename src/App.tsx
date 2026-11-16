import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExplorePage } from './pages/ExplorePage';
import { MatchesPage } from './pages/MatchesPage';
import { ExchangesPage } from './pages/ExchangesPage';
import { MessagesPage } from './pages/MessagesPage';
import { SchedulePage } from './pages/SchedulePage';
import { CirclesPage } from './pages/CirclesPage';
import { MicroSessionsPage } from './pages/MicroSessionsPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { PassportPage } from './pages/PassportPage';
import { WalletPage } from './pages/WalletPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { LoadingSkeleton } from './components/ui/StateViews';

const ProtectedShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F1E8] p-8 max-w-4xl mx-auto">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <Layout>{children}</Layout>;
};

const OnboardingRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F1E8] p-8 max-w-3xl mx-auto">
        <LoadingSkeleton rows={3} />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <OnboardingPage />;
};

const PublicAuthRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    return <Navigate to={user.onboarding_completed ? '/dashboard' : '/onboarding'} replace />;
  }
  return <AuthPage />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<PublicAuthRoute />} />
          <Route path="/onboarding" element={<OnboardingRoute />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedShell>
                <DashboardPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/explore"
            element={
              <ProtectedShell>
                <ExplorePage />
              </ProtectedShell>
            }
          />
          <Route
            path="/matches"
            element={
              <ProtectedShell>
                <MatchesPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/exchanges"
            element={
              <ProtectedShell>
                <ExchangesPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedShell>
                <MessagesPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedShell>
                <SchedulePage />
              </ProtectedShell>
            }
          />
          <Route
            path="/circles"
            element={
              <ProtectedShell>
                <CirclesPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/micro-sessions"
            element={
              <ProtectedShell>
                <MicroSessionsPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/roadmap"
            element={
              <ProtectedShell>
                <RoadmapPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/passport"
            element={
              <ProtectedShell>
                <PassportPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedShell>
                <WalletPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedShell>
                <ProfilePage />
              </ProtectedShell>
            }
          />
          <Route
            path="/peers/:id"
            element={
              <ProtectedShell>
                <ProfilePage />
              </ProtectedShell>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedShell>
                <SettingsPage />
              </ProtectedShell>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedShell>
                <NotificationsPage />
              </ProtectedShell>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
