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
import { resumeAudioContext } from "@/lib/soundEffects";
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
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
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

  // Initialize audio on any user interaction
  useEffect(() => {
    const handleUserInteraction = async () => {
      if (!audioInitialized) {
        console.log('User interaction detected, initializing audio...');
        await initializeAudio();
      }
    };

    // Add listeners for various user interactions
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { once: true, passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
    };
  }, [audioInitialized, initializeAudio]);

  // Add debug message function
  const addDebugMessage = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugMessages(prev => [...prev.slice(-4), `${timestamp}: ${message}`]);
  }, []);

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
      console.log('=== TIMER COMPLETION CALLBACK STARTED ===');
      addDebugMessage('Timer completed - callback started');
      
      // Add device detection info to debug display
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
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
      
      addDebugMessage(`Device: iOS=${isIOS}, iPad=${isIPad}`);
      addDebugMessage(`Screen: ${window.screen.width}x${window.screen.height}`);
      
      console.log('Timer completed - onComplete callback triggered');
      console.log('Current settings:', settings);
      console.log('Settings for sound:', {
        numberOfBeeps: settings.numberOfBeeps,
        volume: settings.volume,
        soundType: settings.soundType
      });

      // iOS Solution: Use notification sounds for background audio
      if (isIOS || isIPad) {
        // iOS: Use notification sounds (works in background)
        addDebugMessage('iOS detected - using notification sounds');
        addDebugMessage(`Notification permission: ${Notification.permission}`);
        
        try {
          await showTimerCompletionNotification({
            numberOfBeeps: settings.numberOfBeeps,
            volume: settings.volume,
            soundType: settings.soundType
          });
          addDebugMessage('Timer completion notification sent');
        } catch (error) {
          addDebugMessage(`Notification error: ${error}`);
        }
      } else {
        // Non-iOS: Use regular audio
        addDebugMessage('Non-iOS: Playing completion sound');
        try {
          await playSound('end', settings.numberOfBeeps, settings.volume, settings.soundType as any);
          addDebugMessage('Non-iOS: Completion sound played successfully');
        } catch (error) {
          addDebugMessage(`Non-iOS sound error: ${error}`);
        }
      }
      
      console.log('Showing toast notification...');
      addDebugMessage('Showing notification...');
      toast({
        title: 'Timer Complete',
        description: 'Your timer has finished!',
      });
      
      console.log('=== TIMER COMPLETION CALLBACK FINISHED ===');
      addDebugMessage('Timer completion callback finished');
    }, [settings.numberOfBeeps, settings.volume, settings.soundType, toast, addDebugMessage])
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
                  onClick={async () => {
                    console.log('Audio test button clicked');
                    await initializeAudio();
                    try {
                      await playSound('start', 1, 50, 'beep');
                      console.log('Audio test successful');
                    } catch (error) {
                      console.error('Audio test failed:', error);
                    }
                  }}
                  title="Test Audio"
                >
                  🔊
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary/80"
                  onClick={async () => {
                    console.log('Timer completion test button clicked');
                    try {
                      // Simulate timer completion
                      await playSound('end', settings.numberOfBeeps, settings.volume, settings.soundType as any);
                      console.log('Timer completion sound test successful');
                    } catch (error) {
                      console.error('Timer completion sound test failed:', error);
                    }
                  }}
                  title="Test Timer Completion Sound"
                >
                  ⏰
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary/80"
                  onClick={async () => {
                    console.log('Manual onComplete callback test clicked');
                    try {
                      // Manually call the onComplete callback logic
                      console.log('=== MANUAL TIMER COMPLETION TEST ===');
                      console.log('Current settings:', settings);
                      console.log('Settings for sound:', {
                        numberOfBeeps: settings.numberOfBeeps,
                        volume: settings.volume,
                        soundType: settings.soundType
                      });
                      
                      console.log('Attempting to play completion sound...');
                      await playSound('end', settings.numberOfBeeps, settings.volume, settings.soundType as any);
                      console.log('Manual timer completion sound test successful');
                      
                      toast({
                        title: 'Timer Complete',
                        description: 'Your timer has finished!',
                      });
                      
                      console.log('=== MANUAL TIMER COMPLETION TEST FINISHED ===');
                    } catch (error) {
                      console.error('Manual timer completion test failed:', error);
                    }
                  }}
                  title="Test onComplete Callback"
                >
                  🔄
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary/80"
                  onClick={async () => {
                    console.log('Audio context test button clicked');
                    addDebugMessage('Testing audio context...');
                    try {
                      // Test audio context state
                      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
                      addDebugMessage(`Audio context state: ${context.state}`);
                      
                      if (context.state === 'suspended') {
                        addDebugMessage('Resuming audio context...');
                        await context.resume();
                        addDebugMessage(`Audio context resumed: ${context.state}`);
                      }
                      
                      // Test simple oscillator
                      const oscillator = context.createOscillator();
                      const gainNode = context.createGain();
                      oscillator.connect(gainNode);
                      gainNode.connect(context.destination);
                      
                      oscillator.frequency.setValueAtTime(440, context.currentTime);
                      gainNode.gain.setValueAtTime(0.1, context.currentTime);
                      
                      addDebugMessage('Playing test tone...');
                      oscillator.start(context.currentTime);
                      oscillator.stop(context.currentTime + 0.5);
                      
                      addDebugMessage('Audio context test successful');
                    } catch (error) {
                      addDebugMessage(`Audio context test failed: ${error}`);
                    }
                  }}
                  title="Test Audio Context"
                >
                  🎵
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary/80"
                  onClick={handleSettingsClick}
                >
                  <span className="material-icons">settings</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary/80"
                  onClick={async () => {
                    console.log('Device detection test clicked');
                    addDebugMessage('Testing device detection...');
                    
                    // Test basic iOS detection
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    addDebugMessage(`Basic iOS detection: ${isIOS}`);
                    
                    // Test iPad detection
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
                    addDebugMessage(`iPad detection: ${isIPad}`);
                    
                    // Show device info
                    addDebugMessage(`User Agent: ${navigator.userAgent.substring(0, 50)}...`);
                    addDebugMessage(`Screen: ${window.screen.width}x${window.screen.height}`);
                    addDebugMessage(`Touch: ${'ontouchstart' in window}, Points: ${navigator.maxTouchPoints}`);
                  }}
                  title="Test Device Detection"
                >
                  📱
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary hover:text-primary/80"
                  onClick={async () => {
                    console.log('Notification test clicked');
                    addDebugMessage('Testing notifications...');
                    addDebugMessage(`Current permission: ${Notification.permission}`);
                    
                    try {
                      if (Notification.permission === 'granted') {
                        addDebugMessage('Permission granted - testing notification');
                        new Notification('Test Notification', {
                          body: 'This is a test notification',
                          icon: '/favicon.ico',
                          badge: '/favicon.ico',
                          silent: false,
                        });
                        addDebugMessage('Test notification sent');
                      } else if (Notification.permission === 'denied') {
                        addDebugMessage('Permission denied - cannot send notifications');
                      } else {
                        addDebugMessage('Requesting notification permission...');
                        const permission = await Notification.requestPermission();
                        addDebugMessage(`Permission result: ${permission}`);
                        if (permission === 'granted') {
                          addDebugMessage('Permission granted - testing notification');
                          new Notification('Test Notification', {
                            body: 'This is a test notification',
                            icon: '/favicon.ico',
                            badge: '/favicon.ico',
                            silent: false,
                          });
                          addDebugMessage('Test notification sent');
                        }
                      }
                    } catch (error) {
                      addDebugMessage(`Notification test error: ${error}`);
                    }
                  }}
                  title="Test Notifications"
                >
                  🔔
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

                {/* Debug Display */}
                {debugMessages.length > 0 && (
                  <div className="bg-black/80 text-white p-3 rounded-lg text-xs max-w-sm">
                    <div className="font-bold mb-1">Debug Messages:</div>
                    {debugMessages.map((msg, index) => (
                      <div key={index} className="mb-1">{msg}</div>
                    ))}
                  </div>
                )}

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
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
