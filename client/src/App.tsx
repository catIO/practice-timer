import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSettings } from '@/lib/localStorage';
import { DEFAULT_SETTINGS } from '@/lib/timerService';
import { applyTheme } from '@/lib/theme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { isRepertoireSubdomain } from '@/lib/subdomain';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import PracticeLog from '@/pages/PracticeLog';
import Report from '@/pages/Report';
import PracticePlan from '@/pages/PracticePlan';
import RepertoireList from '@/pages/RepertoireList';
import RepertoireDetail from '@/pages/RepertoireDetail';
import ResetPassword from '@/pages/ResetPassword';
import { NavigationLayout } from '@/components/NavigationLayout';

const queryClient = new QueryClient();

function AppRoutes() {
  const { isPasswordRecovery } = useAuth();
  const isRepertoire = isRepertoireSubdomain();

  // If the user arrived via a password recovery link, show the reset form
  if (isPasswordRecovery) {
    return (
      <Routes>
        <Route path="*" element={<ResetPassword />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Timer routes */}
      <Route path="/" element={isRepertoire ? <Navigate to="/repertoire" replace /> : <Home />} />
      <Route path="/practice-plan" element={<PracticePlan />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/practice-log" element={<PracticeLog />} />
      <Route path="/report" element={<Report />} />
      <Route path="/report/:token" element={<Report />} />
      <Route path="/r/:id" element={<Report />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Repertoire routes (auth-gated / promo) */}
      <Route path="/repertoire" element={<RepertoireList />} />
      <Route path="/repertoire/:id" element={<ProtectedRoute><RepertoireDetail /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  useEffect(() => {
    // Initialize settings from local storage
    const localSettings = getSettings();
    const currentTheme = localSettings.theme || 'dark';
    applyTheme(currentTheme);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <NavigationLayout>
              <AppRoutes />
            </NavigationLayout>
            <Toaster />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
