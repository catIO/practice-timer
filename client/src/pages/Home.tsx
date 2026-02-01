import { useEffect, useCallback, useState, useRef } from "react";
import Timer from "@/components/Timer";
import TimerControls from "@/components/TimerControls";
import IterationTracker from "@/components/IterationTracker";
import PracticeComplete from "@/components/PracticeComplete";
import { useTimer } from "@/hooks/useTimer";
import { useNotification } from "@/hooks/useNotification";
import { playSound } from "@/lib/soundEffects";
import { useToast } from "@/hooks/use-toast";
import { SettingsType } from "@/lib/timerService";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { resumeAudioContext } from "@/lib/soundEffects";
import { getSettings } from "@/lib/localStorage";
import { iOSBackgroundInstructions } from "@/components/IOSBackgroundInstructions";
import { cleanupWakeLockFallback } from "@/lib/wakeLockFallback";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/stores/timerStore";

import "@/assets/headerBlur.css";

export default function Home() {
  const navigate = useNavigate();
  // Get settings from local storage
  const settings: SettingsType = getSettings();
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  // Setup notifications and toast
  const { toast } = useToast();
  const { showNotification, showTimerCompletionNotification } = useNotification();

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

  // Audio will be initialized only when the play button is clicked
  // This prevents unnecessary audio initialization on other interactions like skip, reset, etc.

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
    totalIterations,
    isPracticeComplete,
    startNewSession
  } = useTimer({
    initialSettings: settings,
    onComplete: useCallback(async () => {
      try {

        // Timer completion callback
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const detectIPad = (): boolean => {
          if (/iPad/.test(navigator.userAgent)) {
            return true;
          }
          if (/Macintosh/.test(navigator.userAgent)) {
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
              const minDimension = Math.min(window.screen.width, window.screen.height);
              const maxDimension = Math.max(window.screen.width, window.screen.height);
              if (minDimension >= 768 && maxDimension >= 1024) {
                return true;
              }
            }
          }
          return false;
        };
        const isIPad = detectIPad();
        

        
        if (isIOS || isIPad) {
          // iOS: Try notification sounds first, then direct audio as fallback


          
          // Try notification first
          try {
            await showTimerCompletionNotification({
              numberOfBeeps: settings.numberOfBeeps,
              volume: settings.volume,
              soundType: settings.soundType
            });
          } catch (error) {
            // Notification error
          }
          
          // Also try direct audio playback as fallback
          try {

            // Force re-initialize audio context for iPad
            await initializeAudio();
            
            // Add a small delay to ensure audio context is ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Try the complex audio system first
            await playSound('end', settings.numberOfBeeps, settings.volume, settings.soundType as any);

            
            // Also try a simple HTML5 audio fallback for iPad
            try {

              
              const audio = new Audio();
              audio.volume = settings.volume / 100;
              
              // Create a simple beep sound using oscillator
              const context = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = context.createOscillator();
              const gainNode = context.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(context.destination);
              
              oscillator.frequency.setValueAtTime(800, context.currentTime);
              gainNode.gain.setValueAtTime(settings.volume / 100, context.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
              
              oscillator.start(context.currentTime);
              oscillator.stop(context.currentTime + 0.5);
              

            } catch (simpleAudioError) {

            }
          } catch (audioError) {

          }
        } else {
          // Non-iOS: Use regular audio

          try {
            await playSound('end', settings.numberOfBeeps, settings.volume, settings.soundType as any);

          } catch (error) {

          }
        }
        

        try {
          toast({
            title: 'Timer Complete',
            description: 'Your timer has finished!',
          });

        } catch (toastError) {

        }
        

      } catch (error) {

      }
    }, [settings.numberOfBeeps, settings.volume, settings.soundType, toast, showTimerCompletionNotification, audioInitialized, initializeAudio])
  });

  // Handle reset all (reset to first iteration)
  const handleResetAll = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Handle reset current (keep current iteration)
  const handleResetCurrent = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Handle skip current session - disable button while skipping to prevent rapid clicks
  const { isSkipping } = useTimerStore();
  const handleSkip = useCallback(() => {
    // Don't allow skip if already skipping
    if (isSkipping) {
      console.log('Skip already in progress, ignoring click');
      return;
    }
    skipTimer();
  }, [skipTimer, isSkipping]);

  // Cleanup wake locks when component unmounts
  useEffect(() => {
    return () => {
      cleanupWakeLockFallback();
    };
  }, []);

  // Handle start timer
  const handleStart = useCallback(async () => {
    // Initialize audio context first when play button is clicked
    console.log('Play button clicked - initializing audio for cross-platform compatibility');
    
    try {
      await initializeAudio();
    } catch (error) {
      console.error('Error initializing audio on play button:', error);
    }
    
    // Then start the timer
    startTimer();
  }, [startTimer, initializeAudio]);

  // Handle pause timer
  const handlePause = useCallback(() => {
    pauseTimer();
  }, [pauseTimer]);

  // Handle settings navigation
  const handleSettingsClick = useCallback(() => {
    if (isRunning) {
      pauseTimer();
    }
    navigate('/settings');
  }, [isRunning, pauseTimer, navigate]);

  // Handle practice log navigation
  const handlePracticeLogClick = useCallback(() => {
    if (isRunning) {
      pauseTimer();
    }
    navigate('/practice-log');
  }, [isRunning, pauseTimer, navigate]);

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



  return (
    <div className="text-foreground font-sans min-h-screen">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="rounded-2xl p-6 bg-gradient-to-t from-gray-800/40 to-black bg-[length:100%_200%] bg-[position:90%_100%] backdrop-blur-sm">
          <header className="relative p-4 flex items-center justify-between overflow-hidden">
            <div className="relative z-10 flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-primary">Practice Timer</h1>
                {/* Wake Lock Status Indicator */}
                {isRunning && (
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    wakeLockActive ? "bg-gray-400 animate-pulse" : "bg-gray-600"
                  )} title={wakeLockActive ? "Wake lock active" : "Wake lock inactive"} />
                )}
                {/* Audio Status Indicator */}
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  audioInitialized ? "bg-green-400" : "bg-gray-600"
                )} title={audioInitialized ? "Audio ready" : "Audio not ready"} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary/80"
                  onClick={handlePracticeLogClick}
                  aria-label="View practice time log"
                  title="Practice time"
                >
                  <span className="material-icons">bar_chart</span>
                </Button>
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
              {isPracticeComplete ? (
                <PracticeComplete
                  currentIteration={currentIteration}
                  totalIterations={totalIterations}
                  onStartNewSession={startNewSession}
                />
              ) : (
                <div className="flex flex-col items-center space-y-6">
                  <Timer
                    timeRemaining={timeRemaining}
                    totalTime={totalTime}
                    mode={mode}
                    isRunning={isRunning}
                  />

                  <TimerControls
                    isRunning={isRunning}
                    onStart={handleStart}
                    onPause={handlePause}
                    onReset={handleResetAll}
                    onSkip={handleSkip}
                    skipDisabled={isSkipping}
                  />

                  <IterationTracker
                    currentIteration={currentIteration}
                    totalIterations={totalIterations}
                    mode={mode}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
