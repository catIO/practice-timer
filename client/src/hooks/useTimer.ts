import { useState, useEffect, useRef, useCallback } from 'react';
import { SettingsType } from '@/lib/timerService';

interface UseTimerProps {
  initialSettings: SettingsType;
  onComplete?: () => void;
}

export function useTimer({ initialSettings, onComplete }: UseTimerProps) {
  const [settings, setSettings] = useState<SettingsType>(initialSettings);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeRemaining, setTimeRemaining] = useState(initialSettings.workDuration * 60);
  const [totalTime, setTotalTime] = useState(initialSettings.workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(1);
  const [totalIterations, setTotalIterations] = useState(initialSettings.iterations || 4);
  
  const timerRef = useRef<number | null>(null);

  // Initialize timer based on current mode and settings
  const initializeTimer = useCallback((currentMode: 'work' | 'break', currentSettings: SettingsType) => {
    const duration = currentMode === 'work' 
      ? currentSettings.workDuration 
      : currentSettings.breakDuration;
    
    setTimeRemaining(duration * 60);
    setTotalTime(duration * 60);
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: SettingsType) => {
    setSettings(newSettings);
    setTotalIterations(newSettings.iterations);
    initializeTimer(mode, newSettings);
  }, [mode, initializeTimer]);

  // Start timer
  const startTimer = useCallback(() => {
    if (!isRunning) {
      setIsRunning(true);
    }
  }, [isRunning]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
    }
  }, [isRunning]);

  // Reset timer
  const resetTimer = useCallback((currentTimerOnly = false) => {
    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setIsRunning(false);
    
    if (currentTimerOnly) {
      // Only reset the current timer duration
      initializeTimer(mode, settings);
    } else {
      // Reset to work mode and first iteration
      setMode('work');
      setCurrentIteration(1);
      // Initialize timer for work mode
      initializeTimer('work', settings);
    }
  }, [settings, mode, initializeTimer]);

  // Skip timer
  const skipTimer = useCallback(() => {
    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setIsRunning(false);
    const nextMode = mode === 'work' ? 'break' : 'work';
    setMode(nextMode);
    initializeTimer(nextMode, settings);
  }, [mode, settings, initializeTimer]);

  // Complete current session and start next one
  const completeSession = useCallback(() => {
    // Clear any existing interval
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (onComplete) {
      onComplete();
    }
    
    // Handle iteration management
    let nextMode: 'work' | 'break' = mode === 'work' ? 'break' : 'work';
    let nextIteration = currentIteration;
    
    // If we're finishing a break session, increment the iteration counter
    if (mode === 'break') {
      nextIteration = currentIteration + 1;
    }
    
    // Check if we've completed all iterations
    if (nextIteration > totalIterations && mode === 'break') {
      // Reset for a new cycle
      nextMode = 'work';
      nextIteration = 1;
      
      // Optionally notify user of completed cycle
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Practice Cycle Complete', {
          body: `You've completed ${totalIterations} work sessions. Great job!`
        });
      }
    }
    
    setMode(nextMode);
    setCurrentIteration(nextIteration);
    initializeTimer(nextMode, settings);
  }, [mode, settings, onComplete, initializeTimer, currentIteration, totalIterations]);

  // Timer logic
  useEffect(() => {
    // Clear any existing interval when running state changes
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isRunning) {
      timerRef.current = window.setInterval(() => {
        setTimeRemaining((prevTime) => {
          if (prevTime <= 1) {
            // Timer complete
            clearInterval(timerRef.current!);
            timerRef.current = null;
            setIsRunning(false);
            completeSession();
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, completeSession]);

  // Initialize timer when mode changes
  useEffect(() => {
    initializeTimer(mode, settings);
  }, [mode, settings, initializeTimer]);

  return {
    timeRemaining,
    totalTime,
    isRunning,
    mode,
    settings,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer,
    updateSettings,
    currentIteration,
    totalIterations
  };
}
