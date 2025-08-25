import { useEffect, useCallback, useState, useRef } from "react";
import Timer from "@/components/Timer";
import TimerControls from "@/components/TimerControls";
import IterationTracker from "@/components/IterationTracker";
import { useTimer } from "@/hooks/useTimer";
import { useNotification } from "@/hooks/useNotification";
import { playSound } from "@/lib/soundEffects";
import { useToast } from "@/hooks/use-toast";
import { SettingsType } from "@/lib/timerService";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { resumeAudioContext, initializeAudioForIOS } from "@/lib/soundEffects";
import { getSettings } from "@/lib/localStorage";
import { Settings, Info } from "lucide-react";
import { iOSBackgroundInstructions } from "@/components/IOSBackgroundInstructions";
import { cleanupWakeLockFallback } from "@/lib/wakeLockFallback";
import { cn } from "@/lib/utils";

import "@/assets/headerBlur.css";

export default function Home() {
  const navigate = useNavigate();
  // Get settings from local storage
  const settings: SettingsType = getSettings();
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  
  // Setup notifications and toast
  const { toast } = useToast();
  const { showNotification, showTimerCompletionNotification } = useNotification();

  // Check if we should show iOS instructions
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIPad = detectIPad();
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    // Show instructions for iOS devices that haven't been dismissed
    if ((isIOS || isIPad) && !isStandalone) {
      const dismissed = localStorage.getItem('ios-instructions-dismissed');
      if (!dismissed) {
        setShowIOSInstructions(true);
      }
    }
  }, []);

  const dismissIOSInstructions = () => {
    setShowIOSInstructions(false);
    localStorage.setItem('ios-instructions-dismissed', 'true');
  };

  // Test audio functionality
  const testAudio = async () => {
    try {
      addDebugInfo('Testing audio functionality...');
      console.log('Testing audio functionality...');
      
      // First ensure audio is initialized
      if (!audioInitialized) {
        addDebugInfo('Audio not initialized, initializing first...');
        await initializeAudio();
      }
      
      // Test with a simple beep
      addDebugInfo('Playing test beep...');
      await playSound('end', 1, 50, 'beep');
      addDebugInfo('Test beep completed successfully');
      
      // Test with multiple beeps
      addDebugInfo('Playing multiple test beeps...');
      await playSound('end', 3, 30, 'beep');
      addDebugInfo('Multiple test beeps completed successfully');
      
    } catch (error) {
      console.error('Audio test failed:', error);
      addDebugInfo(`Audio test failed: ${error}`);
      
      // Try to reinitialize audio and test again
      try {
        addDebugInfo('Attempting to reinitialize audio...');
        setAudioInitialized(false);
        await initializeAudio();
        
        addDebugInfo('Retrying audio test after reinitialization...');
        await playSound('end', 1, 50, 'beep');
        addDebugInfo('Audio test successful after reinitialization');
      } catch (retryError) {
        addDebugInfo(`Audio test failed after reinitialization: ${retryError}`);
      }
    }
  };

  // Add debug info
  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => [...prev.slice(-4), `${timestamp}: ${message}`]);
  }, []);

  // Initialize audio context on user interaction
  const initializeAudio = async () => {
    if (!audioInitialized) {
      try {
        // Check if we're on iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isIPad = detectIPad();
        
        addDebugInfo(`Device: iOS=${isIOS}, iPad=${isIPad}`);
        addDebugInfo(`User Agent: ${navigator.userAgent}`);
        
        if (isIOS || isIPad) {
          console.log('iOS device detected, using iOS-specific audio initialization');
          addDebugInfo('Using iOS-specific audio initialization');
          
          // Use iOS-specific audio initialization
          const success = await initializeAudioForIOS();
          if (success) {
            setAudioInitialized(true);
            console.log('iOS audio context initialized successfully');
            addDebugInfo('iOS audio context initialized successfully');
            
            // Test audio immediately after initialization
            try {
              addDebugInfo('Testing audio immediately after initialization...');
              await playSound('end', 1, 30, 'beep');
              addDebugInfo('Audio test successful after initialization');
            } catch (testError) {
              addDebugInfo(`Audio test failed after initialization: ${testError}`);
            }
          } else {
            console.error('Failed to initialize iOS audio context');
            addDebugInfo('Failed to initialize iOS audio context');
            toast({
              title: "Audio Initialization Failed",
              description: "Please ensure your browser allows audio playback for this site.",
              variant: "destructive",
              duration: 5000,
            });
          }
        } else {
          // Non-iOS devices
          addDebugInfo('Using standard audio initialization');
          const resumed = await resumeAudioContext();
          if (resumed) {
            setAudioInitialized(true);
            console.log('Audio context initialized on user interaction');
            addDebugInfo('Standard audio context initialized successfully');
            
            // Test audio immediately after initialization
            try {
              addDebugInfo('Testing audio immediately after initialization...');
              await playSound('end', 1, 30, 'beep');
              addDebugInfo('Audio test successful after initialization');
            } catch (testError) {
              addDebugInfo(`Audio test failed after initialization: ${testError}`);
            }
          } else {
            console.error('Failed to initialize audio context on user interaction');
            addDebugInfo('Failed to initialize standard audio context');
            toast({
              title: "Audio Initialization Failed",
              description: "Please ensure your browser allows audio playback for this site.",
              variant: "destructive",
              duration: 5000,
            });
          }
        }
      } catch (error) {
        console.error('Error initializing audio:', error);
        addDebugInfo(`Audio initialization error: ${error}`);
        toast({
          title: "Audio Initialization Failed",
          description: "Please ensure your browser allows audio playback for this site.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  };

  // Enhanced iPad detection
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

  // Initialize audio on any user interaction
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (!audioInitialized) {
        console.log('User interaction detected, initializing audio...');
        addDebugInfo('User interaction detected, initializing audio...');
        await initializeAudio();
      }
    };

    // Add listeners for various user interactions
    const events = ['click', 'touchstart', 'keydown', 'mousedown', 'scroll', 'mouseover'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [audioInitialized, initializeAudio, addDebugInfo]);

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
      try {
        console.log('=== TIMER COMPLETION CALLBACK STARTED ===');
        addDebugInfo('Timer completed - callback started');
        
        // Add device detection info to debug display
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isIPad = detectIPad();
        
        console.log('Timer completed - onComplete callback triggered');
        console.log('Device detection:', { isIOS, isIPad });
        addDebugInfo(`Device: iOS=${isIOS}, iPad=${isIPad}`);
        addDebugInfo(`Audio initialized: ${audioInitialized}`);
        
        // Play sound and show notification
        addDebugInfo(`Playing completion sound: beeps=${settings.numberOfBeeps}, volume=${settings.volume}`);
        console.log('About to call showTimerCompletionNotification...');
        addDebugInfo('About to call showTimerCompletionNotification...');
        
        try {
          await showTimerCompletionNotification({
            numberOfBeeps: settings.numberOfBeeps,
            volume: settings.volume,
            soundType: settings.soundType
          });
          console.log('Timer completion notification sent');
          addDebugInfo('Notification sent successfully');
        } catch (notificationError) {
          console.error('Notification failed:', notificationError);
          addDebugInfo(`Notification failed: ${notificationError}`);
        }
        
        // Show toast notification
        console.log('Showing toast notification...');
        addDebugInfo('Showing toast notification');
        toast({
          title: 'Timer Complete',
          description: 'Your timer has finished!',
        });
        
        console.log('=== TIMER COMPLETION CALLBACK FINISHED ===');
        addDebugInfo('Timer completion callback finished');
      } catch (error) {
        console.error('Error in timer completion callback:', error);
        addDebugInfo(`Callback error: ${error}`);
      }
    }, [settings.numberOfBeeps, settings.volume, settings.soundType, toast, showTimerCompletionNotification, addDebugInfo, audioInitialized])
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
    console.log('Skip button clicked');
    addDebugInfo('Skip button clicked');
    skipTimer();
  }, [skipTimer, addDebugInfo]);

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
    addDebugInfo('Play button clicked - initializing audio');
    
    try {
      await initializeAudio();
      addDebugInfo('Audio initialized successfully');
    } catch (error) {
      console.error('Error initializing audio on play button:', error);
      addDebugInfo('Audio initialization failed');
    }
    
    // Then start the timer
    startTimer();
  }, [startTimer, initializeAudio, addDebugInfo]);

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



  return (
    <div className="text-foreground font-sans min-h-screen">
      <div className="max-w-2xl mx-auto pt-8">
        {/* iOS Background Instructions */}
        {/* <iOSBackgroundInstructions 
          isVisible={showIOSInstructions} 
          onDismiss={dismissIOSInstructions}
        /> */}
        
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
                  onClick={handleSettingsClick}
                >
                  <span className="material-icons">settings</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="p-6">
            <div className="space-y-8">
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
                />

                {/* Audio Test Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testAudio}
                  className="mt-4"
                >
                  Test Audio
                </Button>

                <IterationTracker
                  currentIteration={currentIteration}
                  totalIterations={totalIterations}
                  mode={mode}
                />
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Debug Display */}
      {debugInfo.length > 0 && (
        <div className="fixed bottom-4 left-4 bg-black/80 text-white p-3 rounded-lg text-xs max-w-sm z-50">
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold">Debug Info:</div>
            <button
              onClick={() => {
                const debugText = debugInfo.join('\n');
                navigator.clipboard.writeText(debugText).then(() => {
                  addDebugInfo('Debug info copied to clipboard');
                }).catch(() => {
                  addDebugInfo('Failed to copy debug info');
                });
              }}
              className="text-gray-300 hover:text-white text-xs px-2 py-1 rounded border border-gray-600 hover:border-gray-400"
              title="Copy debug info"
            >
              📋
            </button>
          </div>
          {debugInfo.map((msg, index) => (
            <div key={index} className="mb-1">{msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}
