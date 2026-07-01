import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSettings } from '@/lib/localStorage';
import { DEFAULT_SETTINGS } from '@/lib/timerService';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { isRepertoireSubdomain } from '@/lib/subdomain';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import PracticeLog from '@/pages/PracticeLog';
import Report from '@/pages/Report';
import PracticePlan from '@/pages/PracticePlan';
import RepertoireList from '@/pages/RepertoireList';
import RepertoireDetail from '@/pages/RepertoireDetail';

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    // Initialize settings from local storage
    const localSettings = getSettings();
    if (localSettings) {
      // Always ensure dark mode is enabled
      document.documentElement.classList.add('dark');
    } else {
      // Set dark mode by default
      document.documentElement.classList.add('dark');
    }
  }, []);

  const isRepertoire = isRepertoireSubdomain();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Timer routes */}
              <Route path="/" element={isRepertoire ? <Navigate to="/repertoire" replace /> : <Home />} />
              <Route path="/practice-plan" element={<PracticePlan />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/practice-log" element={<PracticeLog />} />
              <Route path="/report" element={<Report />} />
              <Route path="/report/:token" element={<Report />} />
              <Route path="/r/:id" element={<Report />} />
              {/* Repertoire routes (auth-gated) */}
              <Route path="/repertoire" element={<ProtectedRoute><RepertoireList /></ProtectedRoute>} />
              <Route path="/repertoire/:id" element={<ProtectedRoute><RepertoireDetail /></ProtectedRoute>} />
            </Routes>
            <Toaster />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
