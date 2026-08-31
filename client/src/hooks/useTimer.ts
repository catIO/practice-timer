import { useEffect, useRef, useCallback } from 'react';
import { useNotification } from '@/hooks/useNotification';
import { useToast } from '@/hooks/use-toast';
import { resumeAudioContext, playSound } from '@/lib/soundEffects';
import { useTimerStore } from '@/stores/timerStore';
import { saveTimerProgress } from '@/lib/localStorage';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakeLockManager';
import { initializeIOSBackgroundTimer, getIOSBackgroundTimer, cleanupIOSBackgroundTimer } from '@/lib/iOSBackgroundTimer';
import { detectIOS } from '@/lib/device';

interface UseTimerProps {
  initialSettings: any;
  onComplete?: () => void;
}

/**
 * Refactored useTimer hook using Zustand store as single source of truth
 * Preserves all background timing and wake lock functionality
 */
export function useTimer({ initialSettings: _initialSettings, onComplete }: UseTimerProps) {
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
    pieceOvertimeRunning,
    startTimer: storeStartTimer,
    pauseTimer: storePauseTimer,
    resetTimer: storeResetTimer,
    skipTimer: storeSkipTimer,
    completeSession: _storeCompleteSession,
    startNewSession: storeStartNewSession,
    initializeWorker,
    setSettings: setStoreSettings
  } = useTimerStore();

  // Platform-specific refs (preserved for background timing functionality)
  const iosBackgroundTimerRef = useRef<any>(null);
  const serviceWorkerRef = useRef<ServiceWorkerRegistration | null>(null);
  const backgroundSyncRef = useRef<boolean>(false);
  const isIOSRef = useRef<boolean>(false);

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

  // Detect iOS / iPadOS and initialize iOS-specific background timer
  useEffect(() => {
    const isIOS = detectIOS();
    isIOSRef.current = isIOS;

    if (isIOS) {
      // Initialize iOS background timer
      iosBackgroundTimerRef.current = initializeIOSBackgroundTimer({
        onTick: (remaining) => {
          // Update store state from iOS background timer
          useTimerStore.getState().setTimeRemaining(remaining);
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
          // Foreground handling - sync with worker state
          const store = useTimerStore.getState();
          if (store.isRunning) {
            // Worker state will be synced via store message handling
          }
        }
      });
    }

    return () => {
      if (isIOSRef.current) {
        cleanupIOSBackgroundTimer();
      }
    };
  }, [onComplete, showNotification]);

  // Initialize service worker and background sync
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

  // Update background timer state in service worker
  const updateBackgroundTimer = useCallback((timerState: any) => {
    if (serviceWorkerRef.current && backgroundSyncRef.current) {
      serviceWorkerRef.current.active?.postMessage({
        type: 'UPDATE_BACKGROUND_TIMER',
        payload: timerState
      });
    }
  }, []);

  // Start background timer in service worker
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

  // Stop background timer in service worker
  const stopBackgroundTimer = useCallback(() => {
    if (serviceWorkerRef.current && backgroundSyncRef.current) {
      serviceWorkerRef.current.active?.postMessage({
        type: 'STOP_BACKGROUND_TIMER'
      });
    }
  }, []);

  // Handle timer completion with notifications and sounds
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
        let normalizedVolume = volume;
        if (volume <= 1) {
          normalizedVolume = volume * 100;
        }
        normalizedVolume = Math.min(100, Math.max(0, normalizedVolume));

        // Only play if volume is greater than 0
        if (normalizedVolume > 0) {
          await playSound('end', numberOfBeeps, normalizedVolume, soundType);
        }
      } catch (error) {
        console.error('Error playing sound from play-sound event:', error);
      }
    };

    const handleTimerComplete = async (_event: Event) => {
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
          await resumeAudioContext();
          let volume = store.settings.volume;
          if (volume <= 1) {
            volume = volume * 100;
          }
          volume = Math.min(100, Math.max(0, volume));

          if (volume > 0) {
            await playSound('end', store.settings.numberOfBeeps, volume, store.settings.soundType as any);
          }
        } catch (error) {
          console.error('Error playing completion sound:', error);
        }
      }

      // Now set practice complete (this will show the completion screen)
      store.setIsPracticeComplete(true);
      store.setIsRunning(false);
      saveTimerProgress({
        timeRemaining: store.timeRemaining,
        totalTime: store.totalTime,
        mode: store.mode,
        currentIteration: store.currentIteration,
        totalIterations: store.totalIterations,
        isPracticeComplete: true,
      });

      showNotification(
        'Practice Complete!',
        {
          body: `You've completed all ${detail?.totalIterations} work sessions!`,
          requireInteraction: true,
          silent: false
        }
      );
    };

    const handlePieceComplete = async (_event: Event) => {
      try {
        const store = useTimerStore.getState();
        if (store.settings.soundEnabled) {
          await resumeAudioContext();
          let volume = store.settings.volume;
          if (volume <= 1) {
            volume = volume * 100;
          }
          volume = Math.min(100, Math.max(0, volume));
          if (volume > 0) {
            await playSound('end', 1, volume, store.settings.soundType as any);
          }
        }
      } catch (error) {
        console.error('Error playing piece completion sound:', error);
      }
    };

    window.addEventListener('play-sound', handlePlaySound);
    window.addEventListener('timer-complete', handleTimerComplete);
    window.addEventListener('practice-complete', handlePracticeComplete);
    window.addEventListener('piece-timer-complete', handlePieceComplete);

    return () => {
      window.removeEventListener('play-sound', handlePlaySound);
      window.removeEventListener('timer-complete', handleTimerComplete);
      window.removeEventListener('practice-complete', handlePracticeComplete);
      window.removeEventListener('piece-timer-complete', handlePieceComplete);
    };
  }, [workerReady, onComplete, showNotification, toast]);

  // Start timer with wake lock and background support
  const startTimer = useCallback(async () => {
    try {
      // Initialize audio context within user gesture
      try {
        await resumeAudioContext();
      } catch (error) {
        console.error('Error initializing audio context:', error);
      }

      // Request wake lock to prevent screen timeout if user enabled it
      const keepAwake = settings?.keepScreenAwake ?? true;
      if (keepAwake) {
        requestWakeLock().catch(() => {});
      }

      // Start timer in store
      await storeStartTimer();

      // Start background timer for iOS background support
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
  }, [timeRemaining, mode, currentIteration, totalIterations, settings?.keepScreenAwake, storeStartTimer, startBackgroundTimer, toast]);

  // Pause timer
  const pauseTimer = useCallback(async () => {
    if (!isRunning) return;

    await storePauseTimer();
    stopBackgroundTimer();
  }, [isRunning, storePauseTimer, stopBackgroundTimer]);

  // Reset timer
  const resetTimer = useCallback(async () => {
    await storeResetTimer();
    releaseWakeLock().catch(() => {});
  }, [storeResetTimer]);

  // Skip timer
  const skipTimer = useCallback(async () => {
    await storeSkipTimer();
  }, [storeSkipTimer]);

  // Update settings
  const updateSettings = useCallback((newSettings: typeof settings) => {
    setStoreSettings(newSettings);
  }, [setStoreSettings]);

  // Manage wake lock state reactively
  useEffect(() => {
    const keepAwake = settings?.keepScreenAwake ?? true;
    const shouldHoldWakeLock = keepAwake && (isRunning || pieceOvertimeRunning);

    if (shouldHoldWakeLock) {
      requestWakeLock().catch(() => {});
    } else {
      releaseWakeLock().catch(() => {});
    }
  }, [isRunning, pieceOvertimeRunning, settings?.keepScreenAwake]);

  // Clean up wake lock on unmount
  useEffect(() => {
    return () => {
      releaseWakeLock().catch(() => {});
    };
  }, []);

  // Sync iOS background timer with store state when timer starts
  useEffect(() => {
    if (!isIOSRef.current) return;

    const iosTimer = getIOSBackgroundTimer();
    if (!iosTimer) return;

    if (isRunning) {
      iosTimer.start(
        timeRemaining,
        mode,
        currentIteration,
        totalIterations
      );
    } else {
      iosTimer.pause();
    }
  }, [isRunning]); // Only watch isRunning - mode/iteration changes shouldn't trigger timing

  // Update iOS background timer state when running and state changes
  useEffect(() => {
    if (!isIOSRef.current || !isRunning) return;

    const iosTimer = getIOSBackgroundTimer();
    if (iosTimer) {
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
