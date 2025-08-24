import { useEffect, useCallback, useState, useRef } from "react";
import Timer from "@/components/Timer";
import TimerControls from "@/components/TimerControls";
import IterationTracker from "@/components/IterationTracker";
import { useTimer } from "@/hooks/useTimer";
import { useNotification } from "@/hooks/useNotification";
import { useToast } from "@/hooks/use-toast";
import { SettingsType } from "@/lib/timerService";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { resumeAudioContext } from "@/lib/soundEffects";
import { getSettings } from "@/lib/localStorage";
import { Settings, Info } from "lucide-react";
import { iOSBackgroundInstructions } from "@/components/iOSBackgroundInstructions";
import { cleanupWakeLockFallback } from "@/lib/wakeLockFallback";
import { cn } from "@/lib/utils";

import "@/assets/headerBlur.css";

export default function Home() {
  const navigate = useNavigate();
  // Get settings from local storage
  const settings: SettingsType = getSettings();
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  
  // Setup notifications and toast
  const { toast } = useToast();
  const { playSound } = useNotification();

  // Initialize audio context on user interaction
  const initializeAudio = async () => {
    if (!audioInitialized) {
      try {
        const resumed = await resumeAudioContext();
        if (resumed) {
          setAudioInitialized(true);
          console.log('Audio context initialized on user interaction');
        } else {
          console.error('Failed to initialize audio context on user interaction');
          toast({
            title: "Audio Initialization Failed",
            description: "Please ensure your browser allows audio playback for this site.",
            variant: "destructive",
            duration: 5000,
          });
        }
      } catch (error) {
        console.error('Error initializing audio:', error);
        toast({
          title: "Audio Initialization Failed",
          description: "Please ensure your browser allows audio playback for this site.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  };

  const {
    timeRemaining,
    totalTime,
    isRunning,
    mode,
    startTimer,
    pauseTimer,
    resetTimer,
    skipTimer,
    currentIteration,
    totalIterations
  } = useTimer({
    initialSettings: settings,
    onComplete: useCallback(async () => {
      console.log('Timer completed');
      console.log('Settings for sound:', {
        numberOfBeeps: settings.numberOfBeeps,
        volume: settings.volume,
        soundType: settings.soundType
      });
      
      // Play the completion sound
      await playSound(settings);
      
      toast({
        title: 'Timer Complete',
        description: 'Your timer has finished!',
      });
    }, [settings, toast, playSound])
  });

  // Handle reset all (reset to first iteration)
  const handleResetAll = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Handle reset current (keep current iteration)
  const handleResetCurrent = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Handle skip current session
  const handleSkip = useCallback(() => {
    skipTimer();
  }, [skipTimer]);

  // Cleanup wake locks when component unmounts
  useEffect(() => {
    return () => {
      cleanupWakeLockFallback();
    };
  }, []);

  // Handle start timer
  const handleStart = useCallback(async () => {
    // Initialize audio context first
    await initializeAudio();
    // Then start the timer
    startTimer();
  }, [startTimer, initializeAudio]);

  // Handle pause timer
  const handlePause = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  // Handle settings navigation
  const handleSettingsClick = useCallback(() => {
    console.log('Navigating to settings, current timer state:', {
      timeRemaining,
      totalTime,
      mode,
      isRunning
    });
    
    if (isRunning) {
      pauseTimer();
    }
    navigate('/settings');
  }, [isRunning, pauseTimer, navigate, timeRemaining, totalTime, mode]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle spacebar if it's not being used in an input field
      if (event.key === ' ' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
        event.preventDefault(); // Prevent page scroll
        if (isRunning) {
          handlePause();
        } else {
          handleStart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, handleStart, handlePause]);

  // Monitor wake lock status
  useEffect(() => {
    const checkWakeLockStatus = () => {
      // Check if any wake lock is active
      const hasNativeWakeLock = 'wakeLock' in navigator;
      const hasWakeLockFallback = document.querySelector('[data-wake-lock="active"]');
      
      setWakeLockActive(hasNativeWakeLock || !!hasWakeLockFallback);
    };

    // Check initially
    checkWakeLockStatus();

    // Check periodically when timer is running
    const intervalId = isRunning ? setInterval(checkWakeLockStatus, 5000) : null;

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

  // TEMPORARY: Simple test timer to debug the issue
  const [testTimeRemaining, setTestTimeRemaining] = useState(1200);
  const [testIsRunning, setTestIsRunning] = useState(false);
  const testIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTestTimer = useCallback(() => {
    console.log('Starting test timer with time remaining:', testTimeRemaining);
    setTestIsRunning(true);
    
    testIntervalRef.current = setInterval(() => {
      setTestTimeRemaining(prev => {
        const newTime = prev - 1;
        console.log('Test timer tick:', newTime);
        if (newTime <= 0) {
          setTestIsRunning(false);
          if (testIntervalRef.current) {
            clearInterval(testIntervalRef.current);
            testIntervalRef.current = null;
          }
          return 0;
        }
        return newTime;
      });
    }, 1000);
  }, [testTimeRemaining]);

  const pauseTestTimer = useCallback(() => {
    console.log('Pausing test timer');
    setTestIsRunning(false);
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
  }, []);

  const resetTestTimer = useCallback(() => {
    console.log('Resetting test timer');
    setTestTimeRemaining(1200);
    setTestIsRunning(false);
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
  }, []);

  // Cleanup test timer on unmount
  useEffect(() => {
    return () => {
      if (testIntervalRef.current) {
        clearInterval(testIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="text-foreground font-sans min-h-screen">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="rounded-2xl p-6 bg-gradient-to-t from-gray-800/40 to-black bg-[length:100%_200%] bg-[position:90%_100%] backdrop-blur-sm">
          <header className="relative p-4 flex items-center justify-between overflow-hidden">
            <div className="relative z-10 flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-primary">Practice Mate</h1>
                {/* Wake Lock Status Indicator */}
                {isRunning && (
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    wakeLockActive ? "bg-gray-400 animate-pulse" : "bg-gray-600"
                  )} title={wakeLockActive ? "Wake lock active" : "Wake lock inactive"} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary/80"
                  onClick={handleSettingsClick}
                >
                  <span className="material-icons">settings</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6">
            <div className="space-y-8">
              {/* TEMPORARY: Test timer display */}
              <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                <h3 className="text-red-400 font-bold mb-2">TEST TIMER (20:00)</h3>
                <div className="text-3xl font-mono text-red-300 mb-4">
                  {Math.floor(testTimeRemaining / 60)}:{(testTimeRemaining % 60).toString().padStart(2, '0')}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testIsRunning ? pauseTestTimer : startTestTimer}
                    className="text-red-300 border-red-500/50"
                  >
                    {testIsRunning ? 'Pause' : 'Start'} Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetTestTimer}
                    className="text-red-300 border-red-500/50"
                  >
                    Reset Test
                  </Button>
                </div>
              </div>

              <Timer
                timeRemaining={timeRemaining}
                totalTime={totalTime}
                mode={mode}
                isRunning={isRunning}
                wakeLockActive={wakeLockActive}
              />

              <TimerControls
                isRunning={isRunning}
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleResetAll}
                onSkip={handleSkip}
              />

              <IterationTracker
                currentIteration={currentIteration}
                totalIterations={totalIterations}
                mode={mode}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
