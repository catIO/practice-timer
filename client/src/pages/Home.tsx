import { useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Timer from "@/components/Timer";
import TimerControls from "@/components/TimerControls";
import IterationTracker from "@/components/IterationTracker";
import { useTimer } from "@/hooks/useTimer";
import { useNotification } from "@/hooks/useNotification";
import { useToast } from "@/hooks/use-toast";
import { SettingsType, DEFAULT_SETTINGS } from "@/lib/timerService";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  // Fetch user settings from the server
  const { data: settings, isLoading: isLoadingSettings } = useQuery<SettingsType>({
    queryKey: ['/api/settings'],
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: (newSettings: SettingsType) => 
      apiRequest('POST', '/api/settings', newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
    }
  });

  // Get the current settings with fallback to defaults
  const currentSettings: SettingsType = settings || DEFAULT_SETTINGS;
  
  // Initialize the timer with default settings and update with server settings when loaded
  const { 
    timeRemaining, 
    totalTime, 
    isRunning, 
    mode, 
    startTimer, 
    pauseTimer, 
    resetTimer, 
    skipTimer,
    updateSettings,
    currentIteration,
    totalIterations
  } = useTimer({
    initialSettings: currentSettings,
    onComplete: () => {
      // Trigger notification
      if (currentSettings.soundEnabled) {
        playSound();
      }
      if (currentSettings.vibrationEnabled) {
        vibrate();
      }
    }
  });

  // Setup notifications and toast
  const { playSound, vibrate } = useNotification();
  const { toast } = useToast();

  // Update timer settings when server data is loaded or settings change
  useEffect(() => {
    if (settings) {
      console.log('Settings updated:', settings);
      updateSettings(settings);
      // Reset the current timer to apply new duration immediately
      resetTimer(true);
    }
  }, [settings, updateSettings, resetTimer]);

  // Handle reset all (reset to first iteration)
  const handleResetAll = useCallback(() => {
    resetTimer();
    toast({
      title: "Timer Reset",
      description: "Timer has been reset to the first work session",
      variant: "default",
    });
  }, [resetTimer, toast]);

  // Handle current timer reset
  const handleResetCurrent = useCallback(() => {
    resetTimer(true); // true means only reset current timer
    toast({
      title: "Current Timer Reset",
      description: "Current timer has been reset",
      variant: "default",
    });
  }, [resetTimer, toast]);

  return (
    <div className="bg-background text-foreground font-sans min-h-screen">
      {/* Header */}
      <div className="max-w-2xl mx-auto">
        <header className="p-4 bg-card shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="w-10 h-10 rounded-full bg-muted text-foreground hover:bg-red-100 hover:text-red-500 transition-colors"
              onClick={handleResetAll}
              aria-label="Reset to first iteration"
              title="Reset to first work session"
            >
              <span className="material-icons">restart_alt</span>
            </Button>
            <h1 className="text-2xl font-medium">Practice Timer</h1>
          </div>
          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground"
            >
              <span className="material-icons">settings</span>
            </Button>
          </Link>
        </header>

        {/* Timer Section */}
        <section className="p-6 flex flex-col items-center justify-center">
          <div className="mb-4 text-lg font-medium" style={{ color: mode === 'work' ? 'hsl(4, 90%, 58%)' : 'hsl(122, 39%, 49%)' }}>
            {mode === 'work' ? 'Work Time' : 'Break Time'}
          </div>
          
          <Timer 
            timeRemaining={timeRemaining} 
            totalTime={totalTime} 
            mode={mode} 
            isRunning={isRunning} 
          />
          
          <div className="w-full max-w-xs mt-4 mb-6">
            <IterationTracker 
              currentIteration={currentIteration}
              totalIterations={totalIterations}
              mode={mode}
            />
          </div>
          
          <TimerControls 
            isRunning={isRunning} 
            onStart={startTimer} 
            onPause={pauseTimer} 
            onReset={handleResetCurrent}
            onSkip={skipTimer} 
          />
        </section>
      </div>
    </div>
  );
}
