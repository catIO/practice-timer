import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotification } from '@/hooks/useNotification';
import { useToast } from '@/hooks/use-toast';
import { resumeAudioContext } from '@/lib/soundEffects';
import { useTimerStore } from '@/stores/timerStore';
import { SettingsType } from '@/lib/timerService';
import { getSettings } from '@/lib/localStorage';
import { getTimerWorker, addMessageHandler, removeMessageHandler, updateWorkerState, terminateTimerWorker } from '@/lib/timerWorkerSingleton';
import { TimerState } from '@/lib/timerWorkerSingleton';

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
  const { toast } = useToast();
  const startTimeRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const lastSecondRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const lastTimeRemainingRef = useRef<number>(0);
  const timerStore = useTimerStore();
  
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
    }
  }, [mode, settings, currentIteration, totalIterations, setMode, setTimeRemaining, setTotalTime, setIsRunning, setStoreMode, setStoreTimeRemaining, setStoreTotalTime, setStoreIsRunning, setCurrentIteration, setStoreCurrentIteration]);

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
        if (type === 'TICK') {
          console.log('useTimer: Received TICK message:', payload);
          setTimeRemaining(payload.timeRemaining);
          setStoreTimeRemaining(payload.timeRemaining);
        } else if (type === 'COMPLETE') {
          console.log('useTimer: Received COMPLETE message');
          setIsRunning(false);
          setStoreIsRunning(false);
          
          // Call onComplete callback if provided
          if (onComplete) {
            console.log('useTimer: Calling onComplete callback');
            onComplete();
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
    if (!workerRef.current || !isRunning) return;

    // Update local state first
    setIsRunning(false);
    setStoreIsRunning(false);
    
    // Then pause the worker
    workerRef.current.postMessage({ type: 'PAUSE' });
    
    console.log('Timer paused with time remaining:', timeRemaining);
  }, [timeRemaining, isRunning, setIsRunning, setStoreIsRunning]);

  // Handle settings changes
  useEffect(() => {
    if (!workerRef.current) return;
    
    // Get the latest settings
    const savedSettings = getSettings();
    console.log('useTimer: Settings changed, using saved settings:', savedSettings);
    
    // Update store settings
    setStoreSettings(savedSettings);
    
    // Update worker state with saved settings
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
  }, [settings]);

  // Update worker state when timer state changes
  useEffect(() => {
    if (workerRef.current) {
      updateWorkerState(timeRemaining, isRunning);
    }
  }, [timeRemaining, isRunning]);

  // Initialize timer with current settings
  const initializeTimer = useCallback((currentMode: 'work' | 'break', currentSettings: typeof settings) => {
    const duration = currentMode === 'work' 
      ? currentSettings.workDuration 
      : currentSettings.breakDuration;
    
    setTimeRemaining(duration * 60);
    setTotalTime(duration * 60);
    
    // Update worker with new time
    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'UPDATE_TIME',
        payload: { timeRemaining: duration * 60 }
      });
    }
  }, []);

  const updateSettings = useCallback((newSettings: typeof settings) => {
    console.log('Updating settings:', newSettings);
    setSettings(newSettings);
    setTotalIterations(newSettings.iterations || 4);
    
    // If we're in break mode, update the break duration
    if (mode === 'break') {
      initializeTimer('break', newSettings);
    }
    // If we're in work mode, update the work duration
    else {
      initializeTimer('work', newSettings);
    }
  }, [mode, initializeTimer]);

  // Reset timer
  const resetTimer = useCallback(() => {
    if (!workerRef.current) return;

    // Reset worker
    workerRef.current.postMessage({ 
      type: 'RESET',
      payload: { timeRemaining: settings.workDuration * 60 }
    });

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

  // Initialize timer when mode changes
  useEffect(() => {
    // Only initialize timer with new duration if we're not restoring from store
    // This prevents resetting the timer when navigating back from settings
    if (lastTimeRemainingRef.current === 0) {
      initializeTimer(mode, settings);
    }
  }, [mode, settings, initializeTimer]);

  // Start timer
  const startTimer = useCallback(async () => {
    try {
      // Initialize audio context first
      try {
        await resumeAudioContext();
        console.log('Audio context initialized and resumed successfully');
      } catch (error) {
        console.error('Error initializing audio context:', error);
        // Continue even if audio fails - we don't want to block the timer
      }

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

      // Request wake lock
      if ('wakeLock' in navigator) {
        try {
          // Try system wake lock first, fall back to screen wake lock if not supported
          const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
          wakeLockRef.current = await (navigator as any).wakeLock.request(wakeLockType);
        } catch (err) {
          console.log('Error requesting wake lock:', err);
        }
      }

      // Update local state first
      setIsRunning(true);
      setStoreIsRunning(true);
      
      // Then start the worker
      console.log('Starting timer with time remaining:', timeRemaining);
      workerRef.current.postMessage({ 
        type: 'START',
        payload: { 
          timeRemaining,
          mode,
          currentIteration,
          totalIterations
        }
      });
    } catch (error) {
      console.error('Error starting timer:', error);
      toast({
        title: "Error",
        description: "Failed to start timer. Please try again.",
        variant: "destructive",
      });
    }
  }, [timeRemaining, mode, currentIteration, totalIterations, onComplete, completeSession, toast]);

  // Cleanup wake lock on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
          .then(() => {
            wakeLockRef.current = null;
          })
          .catch(err => console.log('Error releasing wake lock:', err));
      }
    };
  }, []);

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
