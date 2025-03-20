import { Switch, Route } from "wouter";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SettingsType, DEFAULT_SETTINGS } from "@/lib/timerService";
import { useDarkMode } from "@/lib/darkModeStore";

function App() {
  // Fetch user settings from the server with staleTime: 0 to ensure fresh data
  const { data: settings } = useQuery<SettingsType>({
    queryKey: ['/api/settings'],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Get the current settings with fallback to defaults
  const currentSettings: SettingsType = settings || DEFAULT_SETTINGS;
  const setIsDark = useDarkMode(state => state.setIsDark);
  
  // Initialize dark mode from settings
  useEffect(() => {
    setIsDark(currentSettings.darkMode);
  }, [currentSettings.darkMode, setIsDark]);

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      // Force a re-render when any query updates
      const newSettings = queryClient.getQueryData<SettingsType>(['/api/settings']);
      if (newSettings) {
        console.log('App - Settings cache updated:', newSettings);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

export default App;
