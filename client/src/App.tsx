import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSettings } from '@/lib/localStorage';
import { DEFAULT_SETTINGS } from '@/lib/timerService';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import { useSettingsStore } from '@/stores/settingsStore';

const queryClient = new QueryClient();

function App() {
  const { setSettings } = useSettingsStore();

  useEffect(() => {
    // Initialize settings from local storage
    const localSettings = getSettings();
    if (localSettings) {
      setSettings(localSettings);
      if (localSettings.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Set dark mode by default
      const defaultSettings = { ...DEFAULT_SETTINGS, darkMode: true };
      setSettings(defaultSettings);
      document.documentElement.classList.add('dark');
    }
  }, [setSettings]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
