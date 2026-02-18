import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSettings } from '@/lib/localStorage';
import { DEFAULT_SETTINGS } from '@/lib/timerService';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import PracticeLog from '@/pages/PracticeLog';
import Report from '@/pages/Report';

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

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/practice-log" element={<PracticeLog />} />
            <Route path="/report" element={<Report />} />
            <Route path="/report/:token" element={<Report />} />
            <Route path="/r/:id" element={<Report />} />
          </Routes>
          <Toaster />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
