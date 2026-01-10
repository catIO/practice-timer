import { useEffect, useRef, useCallback } from 'react';
import { useNotification } from '@/hooks/useNotification';
import { useToast } from '@/hooks/use-toast';
import { resumeAudioContext, playSound } from '@/lib/soundEffects';
import { useTimerStore } from '@/stores/timerStore';
import { getSettings } from '@/lib/localStorage';
import { getWakeLockFallback, cleanupWakeLockFallback } from '@/lib/wakeLockFallback';
import { initializeIOSBackgroundTimer, getIOSBackgroundTimer, cleanupIOSBackgroundTimer } from '@/lib/iOSBackgroundTimer';
import { getIOSWakeLock, cleanupIOSWakeLock } from '@/lib/iOSWakeLock';

interface WakeLock {
  released: boolean;
  release: () => Promise<void>;
}

interface UseTimerProps {
  initialSettings: any;
  onComplete?: () => void;
}

/**
 * Refactored useTimer hook using Zustand store as single source of truth
 * Preserves all background timing and wake lock functionality
 */
export function useTimer({ initialSettings, onComplete }: UseTimerProps) {
  // Get all state from store (single source of truth)
  const {
    timeRemaining,
    totalTime,
    isRunning,
    mode,
    currentIteration,
    totalIterations,
    isPracticeComplete,
    settings,
    workerReady,
    startTimer: storeStartTimer,
    pauseTimer: storePauseTimer,
    resetTimer: storeResetTimer,
    skipTimer: storeSkipTimer,
    completeSession: storeCompleteSession,
    startNewSession: storeStartNewSession,
    initializeWorker,
    setSettings: setStoreSettings
  } = useTimerStore();

  // Platform-specific refs (preserved for background/wake lock functionality)
  const wakeLockRef = useRef<WakeLock | null>(null);
  const wakeLockFallbackRef = useRef<any>(null);
  const iosWakeLockRef = useRef<any>(null);
  const iosBackgroundTimerRef = useRef<any>(null);
  const serviceWorkerRef = useRef<ServiceWorkerRegistration | null>(null);
  const backgroundSyncRef = useRef<boolean>(false);
  const isIOSRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const completeSessionRef = useRef<(() => void) | null>(null);
  
  const { showNotification } = useNotification();
  const { toast } = useToast();

  // Initialize worker connection
  useEffect(() => {
    initializeWorker().catch((error) => {
      console.error('Failed to initialize worker:', error);
      toast({
        title: "Timer Error",
        description: "Failed to initialize timer. Please refresh the page.",
        variant: "destructive",
      });
    });
  }, [initializeWorker, toast]);

  // Detect iOS and initialize iOS-specific components (PRESERVED)
  useEffect(() => {
    const detectIOS = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      isIOSRef.current = isIOS;
      
      if (isIOS) {
        // Initialize iOS background timer (PRESERVED)
        iosBackgroundTimerRef.current = initializeIOSBackgroundTimer({
          onTick: (timeRemaining) => {
            // Update store state from iOS background timer
            useTimerStore.getState().setTimeRemaining(timeRemaining);
          },
          onComplete: async (state) => {
            // When iOS background timer completes, trigger store completion
            const store = useTimerStore.getState();
            store.setIsRunning(false);
            
            // Show notification
            showNotification(
              state.mode === 'work' ? 'Work Time Complete!' : 'Break Time Complete!',
              {
                body: state.mode === 'work' ? 'Time for a break!' : 'Time to get back to work!',
                requireInteraction: true
              }
            );
            
            // Complete session in store (which will handle mode transitions)
            await store.completeSession();
            
            // Call onComplete callback if provided
            if (onComplete) {
              try {
                await onComplete();
              } catch (error) {
                console.error('Error in onComplete callback:', error);
              }
            }
          },
          onBackground: () => {
            // Background handling preserved - iOS background timer takes over
          },
          onForeground: () => {
            // Foreground handling preserved - sync with worker state
            const store = useTimerStore.getState();
            if (store.isRunning) {
              // Sync state when coming to foreground
              // Worker state will be synced via store message handling
            }
          }
        });
        
        // Initialize iOS wake lock (PRESERVED - battery optimized)
        iosWakeLockRef.current = getIOSWakeLock({
          preventScreenTimeout: true,
          preventSystemSleep: true,
          audioContext: true,
          userActivity: false, // Disabled for battery
          fullscreen: false
        });
      }
    };

    detectIOS();

    return () => {
      if (isIOSRef.current) {
        cleanupIOSBackgroundTimer();
        cleanupIOSWakeLock();
      }
    };
  }, [onComplete, showNotification]);

  // Initialize service worker and background sync (PRESERVED)
  useEffect(() => {
    const initializeServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          serviceWorkerRef.current = registration;
          
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            backgroundSyncRef.current = true;
          }
        } catch (error) {
          console.error('Failed to initialize service worker:', error);
        }
      }
    };

    initializeServiceWorker();
  }, []);

  // Update background timer state in service worker (PRESERVED)
  const updateBackgroundTimer = useCallback((timerState: any) => {
    if (serviceWorkerRef.current && backgroundSyncRef.current) {
      serviceWorkerRef.current.active?.postMessage({
        type: 'UPDATE_BACKGROUND_TIMER',
        payload: timerState
      });
    }
  }, []);

  // Start background timer in service worker (PRESERVED)
  const startBackgroundTimer = useCallback((timerState: any) => {
    if (serviceWorkerRef.current && backgroundSyncRef.current) {
      serviceWorkerRef.current.active?.postMessage({
        type: 'START_BACKGROUND_TIMER',
        payload: {
          ...timerState,
          duration: timerState.timeRemaining
        }
      });
    }
  }, []);

  // Stop background timer in service worker (PRESERVED)
  const stopBackgroundTimer = useCallback(() => {
    if (serviceWorkerRef.current && backgroundSyncRef.current) {
      serviceWorkerRef.current.active?.postMessage({
        type: 'STOP_BACKGROUND_TIMER'
      });
    }
  }, []);

  // Handle timer completion with notifications and sounds (PRESERVED)
  useEffect(() => {
    if (!workerReady) return;

    // Track last sound play time to prevent rapid duplicates (within 200ms)
    let lastSoundPlayTime = 0;

    const handlePlaySound = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { numberOfBeeps, volume, soundType } = customEvent.detail;
      
      // Prevent duplicate sound playback within 200ms window
      const now = Date.now();
      if (now - lastSoundPlayTime < 200) {
        console.log('Sound played too recently, ignoring duplicate play-sound event');
        return;
      }
      lastSoundPlayTime = now;
      
      try {
        console.log('Handling play-sound event:', { numberOfBeeps, volume, soundType });
        // Ensure audio context is ready
        await resumeAudioContext();
        // Ensure volume is in 0-100 range
        // Worker sends volume in 0-100 range, but double-check
        let normalizedVolume = volume;
        if (volume <= 1) {
          // Volume is in 0-1 range, convert to 0-100
          normalizedVolume = volume * 100;
        }
        // Clamp to valid range
        normalizedVolume = Math.min(100, Math.max(0, normalizedVolume));
        
        console.log('Normalized volume:', normalizedVolume, 'from original:', volume);
        
        // Only play if volume is greater than 0
        if (normalizedVolume > 0) {
          await playSound('end', numberOfBeeps, normalizedVolume, soundType);
          console.log('Sound from play-sound event finished playing');
        } else {
          console.log('Volume is 0, skipping sound playback');
        }
      } catch (error) {
        console.error('Error playing sound from play-sound event:', error);
      }
    };

    const handleTimerComplete = async (event: Event) => {
      const customEvent = event as CustomEvent;
      // Show notification
      showNotification(
        'Timer Complete!',
        {
          body: 'Your timer has finished!',
          requireInteraction: true,
          silent: false
        }
      );
      
      if (onComplete) {
        try {
          await onComplete();
        } catch (error) {
          console.error('Error in onComplete callback:', error);
        }
      }
    };

    const handlePracticeComplete = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      
      console.log('handlePracticeComplete called with detail:', detail);
      
      // Play sound first if enabled (before showing completion screen)
      const store = useTimerStore.getState();
      if (store.settings.soundEnabled) {
        try {
          console.log('Playing completion sound before showing practice complete screen');
          // Ensure audio context is ready
          await resumeAudioContext();
          // Ensure volume is in 0-100 range (settings might store as 0-1 or 0-100)
          let volume = store.settings.volume;
          if (volume <= 1) {
            // Volume is in 0-1 range, convert to 0-100
            volume = volume * 100;
          }
          // Clamp to valid range
          volume = Math.min(100, Math.max(0, volume));
          
          // Only play if volume is greater than 0
          if (volume > 0) {
            await playSound('end', store.settings.numberOfBeeps, volume, store.settings.soundType as any);
            console.log('Completion sound finished playing');
          } else {
            console.log('Volume is 0, skipping completion sound');
          }
        } catch (error) {
          console.error('Error playing completion sound:', error);
          // Continue even if sound fails
        }
      } else {
        console.log('Sound is disabled, skipping sound playback');
      }
      
      // Now set practice complete (this will show the completion screen)
      store.setIsPracticeComplete(true);
      store.setIsRunning(false);
      
      // Show notification
      showNotification(
        'Practice Complete!',
        {
          body: `You've completed all ${detail?.totalIterations || totalIterations} work sessions!`,
          requireInteraction: true,
          silent: false
        }
      );
      
      // Don't call onComplete for practice completion - it would play sound again
      // The sound has already been played above, and onComplete is meant for regular timer completions
      // For practice completion, we handle everything here (sound, notification, state update)
    };

    window.addEventListener('play-sound', handlePlaySound);
    window.addEventListener('timer-complete', handleTimerComplete);
    window.addEventListener('practice-complete', handlePracticeComplete);

    return () => {
      window.removeEventListener('play-sound', handlePlaySound);
      window.removeEventListener('timer-complete', handleTimerComplete);
      window.removeEventListener('practice-complete', handlePracticeComplete);
    };
  }, [workerReady, onComplete, showNotification, totalIterations]);

  // Start timer with wake lock and background support (PRESERVED)
  const startTimer = useCallback(async () => {
    try {
      // Initialize audio context (PRESERVED)
      try {
        await resumeAudioContext();
      } catch (error) {
        console.error('Error initializing audio context:', error);
      }

      // Request wake lock to prevent screen timeout (PRESERVED)
      try {
        // Release any existing wake locks first
        if (wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
        if (wakeLockFallbackRef.current) {
          await wakeLockFallbackRef.current.release();
          wakeLockFallbackRef.current = null;
        }
        
        // Try native wake lock first (most efficient)
        if ('wakeLock' in navigator) {
          const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
          const wakeLock = await (navigator as any).wakeLock.request(wakeLockType);
          wakeLockRef.current = wakeLock;
          
          if (wakeLock && 'addEventListener' in wakeLock) {
            wakeLock.addEventListener('release', () => {
              wakeLockRef.current = null;
              document.documentElement.removeAttribute('data-wake-lock');
            });
          }
          
          document.documentElement.setAttribute('data-wake-lock', 'active');
        } else {
          // Only use fallback if native wake lock is not available
          const fallback = getWakeLockFallback();
          wakeLockFallbackRef.current = fallback;
          await fallback.request();
        }
      } catch (err) {
        // Silently fail - wake lock is not critical for functionality
      }

      // Start timer in store
      await storeStartTimer();
      
      // Start background timer for iOS background support (PRESERVED)
      startBackgroundTimer({
        timeRemaining,
        mode,
        currentIteration,
        totalIterations,
        isRunning: true
      });
    } catch (error) {
      console.error('Error starting timer:', error);
      toast({
        title: "Error",
        description: "Failed to start timer. Please try again.",
        variant: "destructive",
      });
    }
  }, [timeRemaining, mode, currentIteration, totalIterations, storeStartTimer, startBackgroundTimer, toast]);

  // Pause timer (PRESERVED - wake locks kept active)
  const pauseTimer = useCallback(async () => {
    if (!isRunning) return;

    await storePauseTimer();
    stopBackgroundTimer();
    
    // Keep wake locks active when paused to prevent screen timeout
    // This ensures the screen stays on even when timer is paused
  }, [isRunning, storePauseTimer, stopBackgroundTimer]);

  // Reset timer
  const resetTimer = useCallback(async () => {
    await storeResetTimer();
    
    // Release wake locks when timer is reset
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    if (wakeLockFallbackRef.current) {
      wakeLockFallbackRef.current.release().catch(() => {});
      wakeLockFallbackRef.current = null;
    }
  }, [storeResetTimer]);

  // Skip timer
  const skipTimer = useCallback(async () => {
    await storeSkipTimer();
  }, [storeSkipTimer]);

  // Update settings
  const updateSettings = useCallback((newSettings: typeof settings) => {
    setStoreSettings(newSettings);
    // Settings will apply on next session or reset
  }, [setStoreSettings]);

  // Manage wake lock based on timer state and visibility (PRESERVED)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Page is hidden, but keep wake lock active if timer is running
      } else if (isRunning) {
        // Page is visible and timer is running, ensure wake lock is active
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          try {
            const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
            wakeLockRef.current = await (navigator as any).wakeLock.request(wakeLockType);
          } catch (err) {
            // Ignore errors
          }
        }
        if (!wakeLockRef.current && !wakeLockFallbackRef.current) {
          try {
            const fallback = getWakeLockFallback();
            wakeLockFallbackRef.current = fallback;
            await fallback.request();
          } catch (err) {
            // Ignore errors
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (wakeLockFallbackRef.current) {
        wakeLockFallbackRef.current.release().catch(() => {});
        wakeLockFallbackRef.current = null;
      }
    };
  }, [isRunning]);

  // Ensure wake lock is maintained during timer session (PRESERVED - reduced frequency)
  useEffect(() => {
    const ensureWakeLock = async () => {
      if (isRunning) {
        if (!wakeLockRef.current && !wakeLockFallbackRef.current) {
          try {
            if ('wakeLock' in navigator) {
              const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
              wakeLockRef.current = await (navigator as any).wakeLock.request(wakeLockType);
            } else {
              const fallback = getWakeLockFallback();
              wakeLockFallbackRef.current = fallback;
              await fallback.request();
            }
          } catch (error) {
            // Silently fail
          }
        }
      }
    };

    let intervalId: number | null = null;
    if (isRunning) {
      intervalId = window.setInterval(ensureWakeLock, 120000); // 2 minutes
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

  // Cleanup on unmount (PRESERVED)
  useEffect(() => {
    return () => {
      if (isRunning) {
        storePauseTimer();
      }
      
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      if (wakeLockFallbackRef.current) {
        wakeLockFallbackRef.current.release().catch(() => {});
        wakeLockFallbackRef.current = null;
      }
    };
  }, [isRunning, storePauseTimer]);

  // Sync iOS background timer with store state when timer starts (PRESERVED)
  // Only react to isRunning changes - don't trigger on mode/iteration changes when not running
  useEffect(() => {
    if (!isIOSRef.current) return;
    
    const iosTimer = getIOSBackgroundTimer();
    if (!iosTimer) return;
    
    if (isRunning) {
      // Start iOS background timer with current store state
      iosTimer.start(
        timeRemaining,
        mode,
        currentIteration,
        totalIterations
      );
    } else {
      // Pause iOS background timer when main timer is paused
      iosTimer.pause();
    }
  }, [isRunning]); // Only watch isRunning - mode/iteration changes shouldn't trigger timing
  
  // Update iOS background timer state when running and state changes
  // This only updates if timer is already running (from play button), not from skip
  useEffect(() => {
    if (!isIOSRef.current || !isRunning) return;
    
    const iosTimer = getIOSBackgroundTimer();
    if (iosTimer) {
      // Update state without restarting (only if already running from play button)
      // Skip button changes mode but timer should remain paused
      iosTimer.update({
        timeRemaining,
        mode,
        currentIteration,
        totalIterations
      });
    }
  }, [isRunning, timeRemaining, mode, currentIteration, totalIterations]);

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
    totalIterations,
    isPracticeComplete,
    startNewSession: storeStartNewSession
  };
}
