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
import SharedPieceDetail from '@/pages/SharedPieceDetail';
import { NavigationLayout } from '@/components/NavigationLayout';
import { SharedReportProvider } from '@/contexts/SharedReportContext';

import { ToastProvider, useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

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
      <Route path="/report/:token/piece/:pieceId" element={<SharedPieceDetail />} />
      <Route path="/report/piece/:pieceId" element={<SharedPieceDetail />} />
      <Route path="/r/:id" element={<Report />} />
      <Route path="/r/:id/piece/:pieceId" element={<SharedPieceDetail />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Repertoire routes (auth-gated / promo) */}
      <Route path="/repertoire" element={<RepertoireList />} />
      <Route path="/repertoire/:id" element={<ProtectedRoute><RepertoireDetail /></ProtectedRoute>} />
    </Routes>
  );
}

function AppContent() {
  const { toast } = useToast();

  useEffect(() => {
    // Initialize settings from local storage
    const localSettings = getSettings();
    const currentTheme = localSettings.theme || 'dark';
    applyTheme(currentTheme);
  }, []);

  useEffect(() => {
    const showUpdateToast = (waitingWorker: ServiceWorker) => {
      toast({
        title: "Update Available",
        description: "A new version of the app is ready. Click Update to apply changes.",
        action: (
          <ToastAction
            altText="Update"
            onClick={() => {
              waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            Update
          </ToastAction>
        ),
        duration: Infinity,
      });
    };

    const handleUpdate = (e: Event) => {
      const registration = (e as CustomEvent).detail as ServiceWorkerRegistration;
      const waitingWorker = registration.waiting;
      if (waitingWorker) {
        showUpdateToast(waitingWorker);
      }
    };

    window.addEventListener('sw-update-ready', handleUpdate);

    // If a service worker is already waiting (e.g. from a previous session or registered before App mounted), show toast immediately
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration && registration.waiting) {
          showUpdateToast(registration.waiting);
        }
      }).catch(err => {
        console.warn('Failed to get service worker registration:', err);
      });
    }

    return () => window.removeEventListener('sw-update-ready', handleUpdate);
  }, [toast]);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NavigationLayout>
        <AppRoutes />
      </NavigationLayout>
      <Toaster />
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SharedReportProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </SharedReportProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
