import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotification } from '@/hooks/useNotification';
import { useToast } from '@/hooks/use-toast';
import { resumeAudioContext } from '@/lib/soundEffects';
import { useTimerStore } from '../stores/timerStore';
import { SettingsType } from '@/lib/timerService';
import { getSettings } from '@/lib/localStorage';
import { getTimerWorker, addMessageHandler, removeMessageHandler, updateWorkerState, terminateTimerWorker } from '@/lib/timerWorkerSingleton';
import { TimerState } from '@/lib/timerWorkerSingleton';
import { getWakeLockFallback, cleanupWakeLockFallback } from '@/lib/wakeLockFallback';
import { initializeIOSBackgroundTimer, getIOSBackgroundTimer, cleanupIOSBackgroundTimer } from '@/lib/iOSBackgroundTimer';
import { getIOSWakeLock, cleanupIOSWakeLock } from '@/lib/iOSWakeLock';

interface WakeLock {
  released: boolean;
  release: () => Promise<void>;
}

interface UseTimerProps {
  initialSettings: SettingsType;
  onComplete?: () => void;
}

export function useTimer({ initialSettings, onComplete }: UseTimerProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  const [timeRemaining, setTimeRemaining] = useState(initialSettings.workDuration * 60);
  const [totalTime, setTotalTime] = useState(initialSettings.workDuration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIteration, setCurrentIteration] = useState(1);
  const [totalIterations, setTotalIterations] = useState(initialSettings.iterations || 4);
  
  const workerRef = useRef<Worker | null>(null);
  const { showNotification } = useNotification();
  const wakeLockRef = useRef<WakeLock | null>(null);
  const wakeLockFallbackRef = useRef<any>(null);
  const iosWakeLockRef = useRef<any>(null);
  const iosBackgroundTimerRef = useRef<any>(null);
  const { toast } = useToast();
  const startTimeRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const lastSecondRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const lastTimeRemainingRef = useRef<number>(0);
  const timerStore = useTimerStore();
  const serviceWorkerRef = useRef<ServiceWorkerRegistration | null>(null);
  const backgroundSyncRef = useRef<boolean>(false);
  const isIOSRef = useRef<boolean>(false);
  
  // Cross-platform audio context management
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioArmed, setAudioArmed] = useState(false);
  
  // Initialize audio context for cross-platform compatibility
  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
    return audioContextRef.current;
  }, []);

  // Arm audio on user gesture (required for iOS)
  const armAudio = useCallback(async () => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      // Create a silent buffer to satisfy autoplay heuristics
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.00001; // Near silent
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
      
      setAudioArmed(true);
      console.log('Audio armed successfully for cross-platform compatibility');
    } catch (error) {
      console.error('Failed to arm audio:', error);
    }
  }, [ensureAudioContext]);

  const {
    timeRemaining: storeTimeRemaining,
    totalTime: storeTotalTime,
    isRunning: storeIsRunning,
    mode: storeMode,
    currentIteration: storeCurrentIteration,
    totalIterations: storeTotalIterations,
    setTimeRemaining: setStoreTimeRemaining,
    setTotalTime: setStoreTotalTime,
    setIsRunning: setStoreIsRunning,
    setMode: setStoreMode,
    setCurrentIteration: setStoreCurrentIteration,
    setTotalIterations: setStoreTotalIterations,
    setSettings: setStoreSettings,
  } = useTimerStore();

  // Create refs for callback functions to avoid dependency issues
  const completeSessionRef = useRef<(() => void) | null>(null);

  // Detect iOS and initialize iOS-specific components
  useEffect(() => {
    const detectIOS = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      isIOSRef.current = isIOS;
      
      if (isIOS) {
        console.log('iOS device detected, initializing iOS-specific components');
        
        // Initialize iOS background timer
        iosBackgroundTimerRef.current = initializeIOSBackgroundTimer({
          onTick: (timeRemaining) => {
            setTimeRemaining(timeRemaining);
            setStoreTimeRemaining(timeRemaining);
          },
          onComplete: (state) => {
            setIsRunning(false);
            setStoreIsRunning(false);
            
            showNotification(
              state.mode === 'work' ? 'Work Time Complete!' : 'Break Time Complete!',
              {
                body: state.mode === 'work' ? 'Time for a break!' : 'Time to get back to work!',
                requireInteraction: true
              }
            );
            
            if (onComplete) {
              onComplete();
            }
            
            // Use the ref to call completeSession
            if (completeSessionRef.current) {
              completeSessionRef.current();
            }
          },
          onBackground: () => {
            console.log('Timer going to background on iOS');
          },
          onForeground: () => {
            console.log('Timer coming to foreground on iOS');
          }
        });
        
        // Initialize iOS wake lock
        iosWakeLockRef.current = getIOSWakeLock({
          preventScreenTimeout: true,
          preventSystemSleep: true,
          audioContext: true,
          userActivity: true,
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
  }, [onComplete, showNotification, setIsRunning, setStoreIsRunning]);

  // Initialize service worker and background sync
  useEffect(() => {
    const initializeServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          serviceWorkerRef.current = registration;
          
          // Check for background sync support
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            backgroundSyncRef.current = true;
            console.log('Background sync is supported');
          }
          
          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        } catch (error) {
          console.error('Failed to initialize service worker:', error);
        }
      }
    };

    initializeServiceWorker();

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  // Handle messages from service worker
  const handleServiceWorkerMessage = useCallback((event: MessageEvent) => {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'START_NEXT_SESSION':
        // Handle starting next session from background notification
        completeSession();
        break;
        
      case 'TIMER_COMPLETED':
        // Handle timer completion from background
        handleBackgroundTimerCompletion(payload);
        break;
    }
  }, []);

  // Handle timer completion from background
  const handleBackgroundTimerCompletion = useCallback((payload: any) => {
    setIsRunning(false);
    setStoreIsRunning(false);
    
    // Show notification
    showNotification(
      payload.mode === 'work' ? 'Work Time Complete!' : 'Break Time Complete!',
      {
        body: payload.mode === 'work' ? 'Time for a break!' : 'Time to get back to work!',
        requireInteraction: true
      }
    );
    
    // Call onComplete callback if provided
    if (onComplete) {
      onComplete();
    }
    
    // Complete the current session
    completeSession();
  }, [onComplete, showNotification, setIsRunning, setStoreIsRunning]);

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

  // Complete current session and start next one
  const completeSession = useCallback(() => {
    if (mode === 'work') {
      // After work session, go to break mode for the same iteration
      const newMode = 'break';
      const newTimeRemaining = settings.breakDuration * 60;
      
      // Update local state
      setMode(newMode);
      setTimeRemaining(newTimeRemaining);
      setTotalTime(newTimeRemaining);
      setIsRunning(false);
      
      // Update store state
      setStoreMode(newMode);
      setStoreTimeRemaining(newTimeRemaining);
      setStoreTotalTime(newTimeRemaining);
      setStoreIsRunning(false);
      
      // Update worker state
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'UPDATE_MODE',
          payload: {
            mode: newMode,
            timeRemaining: newTimeRemaining,
            currentIteration,
            totalIterations,
            isRunning: false
          }
        });
      }

      // Update background timer
      updateBackgroundTimer({
        mode: newMode,
        timeRemaining: newTimeRemaining,
        currentIteration,
        totalIterations,
        isRunning: false
      });
    } else {
      // After break session, increment iteration and go to work mode
      const nextIteration = currentIteration + 1;
      const newIteration = nextIteration > totalIterations ? 1 : nextIteration;
      const newMode = 'work';
      const newTimeRemaining = settings.workDuration * 60;
      
      // Update local state
      setCurrentIteration(newIteration);
      setMode(newMode);
      setTimeRemaining(newTimeRemaining);
      setTotalTime(newTimeRemaining);
      setIsRunning(false);
      
      // Update store state
      setStoreCurrentIteration(newIteration);
      setStoreMode(newMode);
      setStoreTimeRemaining(newTimeRemaining);
      setStoreTotalTime(newTimeRemaining);
      setStoreIsRunning(false);
      
      // Update worker state
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'UPDATE_MODE',
          payload: {
            mode: newMode,
            timeRemaining: newTimeRemaining,
            currentIteration: newIteration,
            totalIterations,
            isRunning: false
          }
        });
      }

      // Update background timer
      updateBackgroundTimer({
        mode: newMode,
        timeRemaining: newTimeRemaining,
        currentIteration: newIteration,
        totalIterations,
        isRunning: false
      });
    }
  }, [mode, settings, currentIteration, totalIterations, setMode, setTimeRemaining, setTotalTime, setIsRunning, setStoreMode, setStoreTimeRemaining, setStoreTotalTime, setStoreIsRunning, setCurrentIteration, setStoreCurrentIteration, updateBackgroundTimer]);

  // Update ref with completeSession function
  useEffect(() => {
    completeSessionRef.current = completeSession;
  }, [completeSession]);

  // Initialize settings in store only once
  useEffect(() => {
    console.log('useTimer: Initialization effect running, initializedRef.current:', initializedRef.current);
    
    if (!initializedRef.current) {
      // Get saved settings
      const savedSettings = getSettings();
      console.log('useTimer: Loading saved settings:', savedSettings);
      
      // Always initialize store settings with saved settings
      setStoreSettings(savedSettings);
      
      // Check if we have existing state in the store
      if (storeTimeRemaining > 0) {
        // Calculate the correct duration based on current mode
        const correctDuration = storeMode === 'work' 
          ? savedSettings.workDuration * 60 
          : savedSettings.breakDuration * 60;
        
        // Calculate the progress percentage from the store
        const previousDuration = storeTotalTime;
        const progressPercentage = previousDuration > 0 
          ? (previousDuration - storeTimeRemaining) / previousDuration 
          : 0;
        
        // Calculate new time remaining based on the progress percentage
        const newTimeRemaining = Math.round(correctDuration - (progressPercentage * correctDuration));
        
        console.log('useTimer: Restoring timer state from store with mode:', storeMode, {
          previousTimeRemaining: storeTimeRemaining,
          newTimeRemaining,
          correctDuration,
          progressPercentage,
          workDuration: savedSettings.workDuration * 60,
          breakDuration: savedSettings.breakDuration * 60
        });
        
        // Restore state from store with adjusted time remaining
        setTimeRemaining(newTimeRemaining);
        setTotalTime(correctDuration);
        setIsRunning(storeIsRunning);
        setMode(storeMode);
        setCurrentIteration(storeCurrentIteration);
        setTotalIterations(storeTotalIterations);
        
        // Update store with correct times
        setStoreTimeRemaining(newTimeRemaining);
        setStoreTotalTime(correctDuration);
        
        // Update worker state
        if (workerRef.current) {
          updateWorkerState(
            newTimeRemaining,
            storeIsRunning,
            storeMode,
            storeCurrentIteration,
            storeTotalIterations
          );
        }
        
        console.log('useTimer: Restored timer state from store:', {
          timeRemaining: newTimeRemaining,
          totalTime: correctDuration,
          isRunning: storeIsRunning,
          mode: storeMode,
          currentIteration: storeCurrentIteration,
          totalIterations: storeTotalIterations
        });
      } else {
        // Initialize with saved settings
        const workDuration = savedSettings.workDuration * 60;
        setSettings(savedSettings);
        setStoreTotalIterations(savedSettings.iterations);
        setStoreTimeRemaining(workDuration);
        setStoreTotalTime(workDuration);
        setStoreCurrentIteration(1);
        setTimeRemaining(workDuration);
        setTotalTime(workDuration);
        setTotalIterations(savedSettings.iterations);
        console.log('useTimer: Initialized timer with saved settings:', savedSettings);
      }
      initializedRef.current = true;
    }
  }, []);

  // Initialize worker and settings
  useEffect(() => {
    let cleanup = false;
    let isMounted = true;
    let workerInitialized = false;

    const initializeWorker = async () => {
      try {
        // Only initialize if we don't have a worker and haven't initialized yet
        if (!workerRef.current && !workerInitialized) {
          workerInitialized = true;
          console.log('useTimer: Initializing worker');
          const worker = await getTimerWorker();
          if (!isMounted) {
            console.log('useTimer: Component unmounted during initialization');
            return;
          }
          workerRef.current = worker;
          
          // Get saved settings
          const savedSettings = getSettings();
          console.log('useTimer: Loading saved settings:', savedSettings);
          
          // Calculate the correct duration from saved settings
          const correctDuration = savedSettings.workDuration * 60;
          
          // Restore state from store if it exists
          const { timeRemaining, isRunning, mode, currentIteration, totalIterations } = timerStore;
          if (timeRemaining > 0) {
            console.log('useTimer: Restoring timer state from store:', {
              timeRemaining,
              isRunning,
              mode,
              currentIteration,
              totalIterations
            });
            lastTimeRemainingRef.current = timeRemaining;
            setTimeRemaining(timeRemaining);
            setMode(mode);
            setCurrentIteration(currentIteration);
            setTotalIterations(totalIterations);
            
            // Set the correct total time based on the current mode
            const correctTotalTime = mode === 'work' ? savedSettings.workDuration * 60 : savedSettings.breakDuration * 60;
            setTotalTime(correctTotalTime);
            setStoreTotalTime(correctTotalTime);
            
            // Update worker state
            updateWorkerState(
              timeRemaining,
              isRunning,
              mode,
              currentIteration,
              totalIterations
            );
          } else {
            // Initialize with saved settings
            console.log('useTimer: Initializing with saved duration:', correctDuration);
            setTimeRemaining(correctDuration);
            setTotalTime(correctDuration);
            setStoreTimeRemaining(correctDuration);
            setStoreTotalTime(correctDuration);
            updateWorkerState(
              correctDuration,
              false,
              'work',
              1,
              savedSettings.iterations
            );
          }
        }
      } catch (error) {
        console.error('useTimer: Failed to initialize worker:', error);
      }
    };

    initializeWorker();

    return () => {
      cleanup = true;
      isMounted = false;
    };
  }, [onComplete, completeSession, timerStore]);

  // Handle cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Only pause the timer if it's running when the component unmounts
      if (workerRef.current && isRunning) {
        console.log('useTimer: Pausing timer on unmount');
        workerRef.current.postMessage({ type: 'PAUSE' });
        setIsRunning(false);
        setStoreIsRunning(false);
      }
    };
  }, [isRunning, setIsRunning, setStoreIsRunning]);

  // Set up message handler for worker
  useEffect(() => {
    let messageHandler: ((event: MessageEvent) => void) | null = null;

    if (workerRef.current) {
      // Add message handler for TICK and COMPLETE messages
      messageHandler = (event: MessageEvent) => {
        const { type, payload } = event.data;
        console.log('useTimer: Received message from worker:', type, payload);
        
        if (type === 'TICK') {
          console.log('useTimer: Received TICK message from worker');
          console.log('useTimer: TICK payload:', payload);
          
          // Update local state
          setTimeRemaining(payload.timeRemaining);
          setStoreTimeRemaining(payload.timeRemaining);
          setMode(payload.mode);
          setCurrentIteration(payload.currentIteration);
          setTotalIterations(payload.totalIterations);
          
          // iOS Fallback: Check if timer should be complete
          if (payload.timeRemaining <= 0 && isRunning) {
            console.log('useTimer: iOS Fallback - Timer reached zero, triggering completion');
            setIsRunning(false);
            setStoreIsRunning(false);
            
            // Show notification immediately when timer completes
            showNotification(
              'Timer Complete!',
              {
                body: 'Your timer has finished!',
                requireInteraction: true,
                silent: false
              }
            );
            
            // Call onComplete callback if provided
            if (onComplete) {
              console.log('useTimer: iOS Fallback - Calling onComplete callback');
              try {
                onComplete();
                console.log('useTimer: iOS Fallback - onComplete callback executed successfully');
              } catch (error) {
                console.error('useTimer: iOS Fallback - Error in onComplete callback:', error);
              }
            } else {
              console.log('useTimer: iOS Fallback - No onComplete callback provided');
            }
            
            // Complete the current session
            completeSession();
          }
        } else if (type === 'TIME_UPDATED') {
          console.log('useTimer: Received TIME_UPDATED message:', payload);
          // Only update if timer is not running to prevent interference
          if (!isRunning) {
            setTimeRemaining(payload.timeRemaining);
            setStoreTimeRemaining(payload.timeRemaining);
          } else {
            console.log('useTimer: Timer is running, skipping TIME_UPDATED');
          }
        } else if (type === 'COMPLETE') {
          console.log('useTimer: Received COMPLETE message from worker');
          console.log('useTimer: COMPLETE payload:', payload);
          setIsRunning(false);
          setStoreIsRunning(false);
          
          // Show notification immediately when timer completes
          showNotification(
            'Timer Complete!',
            {
              body: 'Your timer has finished!',
              requireInteraction: true,
              silent: false
            }
          );
          
          // Call onComplete callback if provided
          if (onComplete) {
            console.log('useTimer: Calling onComplete callback');
            try {
              onComplete();
              console.log('useTimer: onComplete callback executed successfully');
            } catch (error) {
              console.error('useTimer: Error in onComplete callback:', error);
            }
          } else {
            console.log('useTimer: No onComplete callback provided');
          }
          
          // Complete the current session
          completeSession();
        }
      };
      
      addMessageHandler(messageHandler);
    }

    return () => {
      // Remove message handler if it exists
      if (messageHandler) {
        removeMessageHandler(messageHandler);
      }
    };
  }, [workerRef.current, onComplete, completeSession, setIsRunning, setStoreIsRunning]);

  // Pause timer
  const pauseTimer = useCallback(() => {
    if (!isRunning) return;

    // Use worker for all platforms (including iOS) for reliable background operation
    console.log('Pausing timer with worker');

    // Non-iOS timer pause (existing logic)
    if (!workerRef.current) return;

    // Update local state first
    setIsRunning(false);
    setStoreIsRunning(false);
    
    // Then pause the worker
    workerRef.current.postMessage({ type: 'PAUSE' });
    
    // Stop background timer
    stopBackgroundTimer();
    
    // Keep wake locks active when timer is paused to prevent screen timeout
    // Only release wake locks when timer is completely stopped or reset
    console.log('Timer paused - keeping wake lock active to prevent screen timeout');
    
    console.log('Timer paused with time remaining:', timeRemaining);
  }, [timeRemaining, isRunning, setIsRunning, setStoreIsRunning, stopBackgroundTimer]);

  // Handle settings changes
  useEffect(() => {
    if (!workerRef.current) return;
    
    // Get the latest settings
    const savedSettings = getSettings();
    console.log('useTimer: Settings changed, using saved settings:', savedSettings);
    
    // Update store settings
    setStoreSettings(savedSettings);
    
    // Only update worker state if timer is not running
    if (!isRunning) {
      const newDuration = savedSettings.workDuration * 60;
      console.log('useTimer: Updating worker state with saved duration:', newDuration);
      
      // Update worker state without resetting timer
      updateWorkerState(
        newDuration,
        false,
        'work',
        1,
        savedSettings.iterations
      );
    } else {
      console.log('useTimer: Timer is running, skipping settings update');
    }
  }, [settings, isRunning]);

  // Update worker state when timer state changes
  useEffect(() => {
    if (workerRef.current && !isRunning) {
      // Only update worker state when timer is not running to avoid interference
      console.log('useTimer: Updating worker state - timeRemaining:', timeRemaining, 'isRunning:', isRunning);
      updateWorkerState(timeRemaining, isRunning);
    } else if (workerRef.current && isRunning) {
      console.log('useTimer: Timer is running, skipping worker state update to prevent interference');
    }
  }, [timeRemaining, isRunning]);

  // Initialize timer with current settings
  const initializeTimer = useCallback((currentMode: 'work' | 'break', currentSettings: typeof settings) => {
    // Don't initialize if timer is running
    if (isRunning) {
      console.log('useTimer: Timer is running, skipping initialization');
      return;
    }
    
    const duration = currentMode === 'work' 
      ? currentSettings.workDuration 
      : currentSettings.breakDuration;
    
    console.log('useTimer: Initializing timer - mode:', currentMode, 'duration:', duration * 60);
    
    setTimeRemaining(duration * 60);
    setTotalTime(duration * 60);
    
    // Update worker with new time
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'UPDATE_TIME',
        payload: { timeRemaining: duration * 60 }
      });
    }
  }, [isRunning]);

  const updateSettings = useCallback((newSettings: typeof settings) => {
    console.log('Updating settings:', newSettings);
    setSettings(newSettings);
    setTotalIterations(newSettings.iterations || 4);
    
    // Only update timer duration if timer is not running
    if (!isRunning) {
      // If we're in break mode, update the break duration
      if (mode === 'break') {
        initializeTimer('break', newSettings);
      }
      // If we're in work mode, update the work duration
      else {
        initializeTimer('work', newSettings);
      }
    } else {
      console.log('useTimer: Timer is running, skipping settings update');
    }
  }, [mode, initializeTimer, isRunning]);

  // Reset timer
  const resetTimer = useCallback(() => {
    // Use worker for all platforms (including iOS) for reliable background operation
    console.log('Resetting timer with worker');

    // Non-iOS timer reset
    if (!workerRef.current) return;

    // Reset worker
    workerRef.current.postMessage({ 
      type: 'RESET',
      payload: { timeRemaining: settings.workDuration * 60 }
    });

    // Release wake locks when timer is reset
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
        .then(() => {
          wakeLockRef.current = null;
          console.log('Wake lock released due to timer reset');
        })
        .catch(err => console.log('Error releasing wake lock:', err));
    }
    
    if (wakeLockFallbackRef.current) {
      wakeLockFallbackRef.current.release()
        .then(() => {
          wakeLockFallbackRef.current = null;
          console.log('Fallback wake lock released due to timer reset');
        })
        .catch(err => console.log('Error releasing fallback wake lock:', err));
    }

    // Reset all state
    setIsRunning(false);
    setMode('work');
    setCurrentIteration(1);
    setTimeRemaining(settings.workDuration * 60);
    setTotalTime(settings.workDuration * 60);

    // Update store state
    setStoreIsRunning(false);
    setStoreMode('work');
    setStoreCurrentIteration(1);
    setStoreTimeRemaining(settings.workDuration * 60);
    setStoreTotalTime(settings.workDuration * 60);
  }, [settings, setStoreIsRunning, setStoreMode, setStoreCurrentIteration, setStoreTimeRemaining, setStoreTotalTime]);

  // Skip timer
  const skipTimer = useCallback(() => {
    completeSession();
  }, [completeSession]);

  // Initialize timer when mode changes (only when not running)
  useEffect(() => {
    // Only initialize timer with new duration if we're not restoring from store and timer is not running
    // This prevents resetting the timer when navigating back from settings or when timer is active
    if (lastTimeRemainingRef.current === 0 && !isRunning) {
      console.log('useTimer: Initializing timer for mode change - mode:', mode, 'isRunning:', isRunning);
      initializeTimer(mode, settings);
    } else if (lastTimeRemainingRef.current === 0 && isRunning) {
      console.log('useTimer: Timer is running, skipping initialization for mode change');
    }
  }, [mode, settings, initializeTimer, isRunning]);

  // Start timer
  const startTimer = useCallback(async () => {
    try {
      // Cross-platform audio arming (required for iOS)
      if (!audioArmed) {
        console.log('Arming audio for cross-platform compatibility...');
        await armAudio();
      }

      // Initialize audio context first
      try {
        await resumeAudioContext();
        console.log('Audio context initialized and resumed successfully');
      } catch (error) {
        console.error('Error initializing audio context:', error);
        // Continue even if audio fails - we don't want to block the timer
      }

      // Use worker for all platforms (including iOS) for reliable background operation
      console.log('Starting timer with worker for reliable background operation');

      // Non-iOS timer start (existing logic)
      // Ensure worker is initialized
      if (!workerRef.current) {
        console.log('Worker not initialized, initializing now...');
        try {
          workerRef.current = await getTimerWorker();
          if (!workerRef.current) {
            throw new Error('Failed to initialize worker');
          }
          
          // Update worker state
          updateWorkerState(
            timeRemaining,
            false,
            mode,
            currentIteration,
            totalIterations
          );
        } catch (error) {
          console.error('Error initializing worker:', error);
          toast({
            title: "Error",
            description: "Failed to initialize timer. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      // Request wake lock to prevent screen timeout
      try {
        // Try native wake lock first
        if ('wakeLock' in navigator) {
          // Release any existing wake lock first
          if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
          }
          
          // Try system wake lock first, fall back to screen wake lock if not supported
          const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
          wakeLockRef.current = await (navigator as any).wakeLock.request(wakeLockType);
          
          // Add event listener for wake lock release
          wakeLockRef.current.addEventListener('release', () => {
            console.log('Wake lock was released');
            wakeLockRef.current = null;
            // Remove data attribute
            document.documentElement.removeAttribute('data-wake-lock');
          });
          
          // Add data attribute to track wake lock status
          document.documentElement.setAttribute('data-wake-lock', 'active');
          console.log('Native wake lock acquired successfully');
        } else {
          // Use fallback wake lock
          const fallback = getWakeLockFallback();
          wakeLockFallbackRef.current = fallback;
          await fallback.request();
          console.log('Fallback wake lock activated');
        }
      } catch (err) {
        console.error('Error requesting wake lock:', err);
        // Try fallback as last resort
        try {
          const fallback = getWakeLockFallback();
          wakeLockFallbackRef.current = fallback;
          await fallback.request();
          console.log('Fallback wake lock activated after error');
        } catch (fallbackErr) {
          console.error('All wake lock methods failed:', fallbackErr);
        }
      }

      // Update local state first
      setIsRunning(true);
      setStoreIsRunning(true);
      
      // Then start the worker
      console.log('useTimer: Starting timer with time remaining:', timeRemaining);
      console.log('useTimer: Timer mode:', mode);
      console.log('useTimer: Current iteration:', currentIteration);
      console.log('useTimer: Total iterations:', totalIterations);
      
      console.log('useTimer: Sending START message to worker');
      workerRef.current.postMessage({ 
        type: 'START',
        payload: { 
          timeRemaining,
          mode,
          currentIteration,
          totalIterations
        }
      });
      console.log('useTimer: START message sent to worker');

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
  }, [timeRemaining, mode, currentIteration, totalIterations, onComplete, completeSession, toast, startBackgroundTimer, armAudio, audioArmed]);

  // Manage wake lock based on timer state and visibility
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Page is hidden, but keep wake lock active if timer is running
        // This prevents screen timeout during timer
        console.log('Page hidden, but keeping wake lock active for timer');
      } else if (isRunning) {
        // Page is visible and timer is running, ensure wake lock is active
        if ('wakeLock' in navigator && !wakeLockRef.current) {
          try {
            const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
            wakeLockRef.current = await (navigator as any).wakeLock.request(wakeLockType);
            console.log('Wake lock re-acquired when page became visible');
          } catch (err) {
            console.error('Error re-acquiring wake lock:', err);
          }
        }
        // Re-request fallback wake lock if needed
        if (!wakeLockRef.current && !wakeLockFallbackRef.current) {
          try {
            const fallback = getWakeLockFallback();
            wakeLockFallbackRef.current = fallback;
            await fallback.request();
            console.log('Fallback wake lock re-acquired when page became visible');
          } catch (err) {
            console.error('Error re-acquiring fallback wake lock:', err);
          }
        }
        
        // Sync timer state when page becomes visible to ensure accuracy
        if (workerRef.current) {
          console.log('Page became visible, syncing timer state');
          workerRef.current.postMessage({
            type: 'SYNC_STATE',
            payload: {
              timeRemaining,
              mode,
              currentIteration,
              totalIterations,
              isRunning
            }
          });
        }
      }
    };

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup wake lock on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
          .then(() => {
            wakeLockRef.current = null;
          })
          .catch(err => console.log('Error releasing wake lock:', err));
      }
      if (wakeLockFallbackRef.current) {
        wakeLockFallbackRef.current.release()
          .then(() => {
            wakeLockFallbackRef.current = null;
          })
          .catch(err => console.log('Error releasing fallback wake lock:', err));
      }
    };
  }, [isRunning, timeRemaining, mode, currentIteration, totalIterations]);

  // Ensure wake lock is maintained during timer session
  useEffect(() => {
    const ensureWakeLock = async () => {
      if (isRunning) {
        // Timer is running, ensure wake lock is active
        if (!wakeLockRef.current && !wakeLockFallbackRef.current) {
          console.log('Timer is running but no wake lock active, requesting wake lock...');
          
          try {
            // Try native wake lock first
            if ('wakeLock' in navigator) {
              const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
              wakeLockRef.current = await (navigator as any).wakeLock.request(wakeLockType);
              console.log('Wake lock re-acquired for running timer');
            } else {
              // Use fallback wake lock
              const fallback = getWakeLockFallback();
              wakeLockFallbackRef.current = fallback;
              await fallback.request();
              console.log('Fallback wake lock re-acquired for running timer');
            }
          } catch (error) {
            console.error('Failed to re-acquire wake lock for running timer:', error);
          }
        }
      }
    };

    // Check wake lock status every 30 seconds when timer is running
    let intervalId: number | null = null;
    if (isRunning) {
      intervalId = window.setInterval(ensureWakeLock, 30000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRunning]);

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
