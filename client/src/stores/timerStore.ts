import { create } from 'zustand';
import { SettingsType, DEFAULT_SETTINGS } from '@/lib/timerService';
import { getSettings } from '@/lib/localStorage';
import { addPracticeTime } from '@/lib/practiceLog';
import { getTimerWorker, addMessageHandler, removeMessageHandler } from '@/lib/timerWorkerSingleton';

// Clean up stale pending messages (older than 5 seconds) - global cleanup
if (typeof window !== 'undefined') {
  setInterval(() => {
    // This will be handled per-store instance
  }, 1000);
}

interface TimerState {
  // Core timer state
  timeRemaining: number;
  totalTime: number;
  isRunning: boolean;
  mode: 'work' | 'break';
  currentIteration: number;
  totalIterations: number;
  isPracticeComplete: boolean;
  isSkipping: boolean; // Flag to prevent concurrent skip operations
  
  // Settings
  settings: SettingsType;
  
  // Worker state
  workerReady: boolean;
  lastMessageSequence: number;
  
  // Actions
  setTimeRemaining: (time: number) => void;
  setTotalTime: (time: number) => void;
  setIsRunning: (isRunning: boolean) => void;
  setMode: (mode: 'work' | 'break') => void;
  setCurrentIteration: (iteration: number) => void;
  setTotalIterations: (iterations: number) => void;
  setIsPracticeComplete: (complete: boolean) => void;
  setSettings: (settings: SettingsType) => void;
  setWorkerReady: (ready: boolean) => void;
  
  // Complex actions
  startTimer: () => Promise<void>;
  pauseTimer: () => Promise<void>;
  resetTimer: () => Promise<void>;
  skipTimer: () => Promise<void>;
  completeSession: () => Promise<void>;
  startNewSession: () => Promise<void>;
  
  // Initialize worker connection
  initializeWorker: () => Promise<void>;
}

// Get saved settings or use defaults
const savedSettings = getSettings();
const DEFAULT_WORK_TIME = savedSettings.workDuration * 60;

// Global flag to prevent duplicate initialization (React StrictMode causes double renders in dev)
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

export const useTimerStore = create<TimerState>((set, get) => {
  let worker: Worker | null = null;
  let messageHandler: ((event: MessageEvent) => void) | null = null;
  
  // Message sequencing to prevent race conditions
  let messageSequence = 0;
  const pendingMessages = new Map<number, { timestamp: number; resolve: () => void; type: string; payload?: any }>();
  
  // Track skip timeout to clear it when UPDATE_MODE is received
  let skipTimeoutId: NodeJS.Timeout | null = null;

  // Send message to worker with sequence number
  const sendMessage = (type: string, payload?: any, retryOnStale = false): Promise<void> => {
    return new Promise((resolve) => {
      if (!worker) {
        resolve();
        return;
      }
      
      const sequence = ++messageSequence;
      const message = { type, payload, sequence };
      
      // Store pending message with metadata for potential retry
      pendingMessages.set(sequence, {
        timestamp: Date.now(),
        resolve,
        type,
        payload
      });
      
      worker.postMessage(message);
      
      // Timeout after 1 second (for messages that don't get responses)
      setTimeout(() => {
        if (pendingMessages.has(sequence)) {
          pendingMessages.delete(sequence);
          resolve();
        }
      }, 1000);
    });
  };

  // Initialize worker and set up message handling
  const initializeWorker = async () => {
    if (worker) return; // Already initialized
    if (isInitializing) {
      // Wait for existing initialization to complete
      if (initializationPromise) {
        await initializationPromise;
      }
      return;
    }
    
    isInitializing = true;
    initializationPromise = (async () => {
      try {
        worker = await getTimerWorker();
        
        // Sync settings to worker immediately (settings are in minutes)
        const currentSettings = get().settings;
        await sendMessage('UPDATE_SETTINGS', currentSettings);
        
        // Set up message handler with sequence number validation
        messageHandler = (event: MessageEvent) => {
        const { type, payload, sequence } = event.data;
        
        // Handle message types
        switch (type) {
          case 'ACK':
            // Handle acknowledgment from worker (including stale message notifications)
            if (sequence !== undefined && pendingMessages.has(sequence)) {
              const pending = pendingMessages.get(sequence);
              if (pending) {
                pendingMessages.delete(sequence);
                if (payload?.ignored && payload?.reason === 'stale') {
                  console.warn('Store: Worker rejected message as stale, sequence:', sequence, 'type:', pending.type);
                  // For UPDATE_MODE messages, we need to retry with a fresh sequence
                  // The worker's lastReceivedSequence is ahead of our counter
                  if (pending.type === 'UPDATE_MODE') {
                    console.log('Store: Retrying UPDATE_MODE with fresh sequence number');
                    // Retry the message with a new sequence number
                    const retrySequence = ++messageSequence;
                    const retryMessage = { type: pending.type, payload: pending.payload, sequence: retrySequence };
                    pendingMessages.set(retrySequence, {
                      timestamp: Date.now(),
                      resolve: pending.resolve,
                      type: pending.type,
                      payload: pending.payload
                    });
                    if (worker) {
                      worker.postMessage(retryMessage);
                    }
                  } else {
                    // For other message types, just resolve to avoid hanging
                    pending.resolve();
                  }
                } else {
                  // Normal ACK, resolve the promise
                  pending.resolve();
                }
              }
            }
            break;

          case 'TICK':
            // For TICK messages, validate sequence but always process if valid
            if (sequence !== undefined) {
              const lastSeq = get().lastMessageSequence;
              if (sequence <= lastSeq) {
                // Stale message, ignore
                return;
              }
              // Update sequence number for valid messages
              set({ lastMessageSequence: sequence });
            }
            // Update state with new timeRemaining
            set({ 
              timeRemaining: payload.timeRemaining,
              mode: payload.mode,
              currentIteration: payload.currentIteration,
              totalIterations: payload.totalIterations
            });
            break;

          case 'PAUSED':
            // Validate sequence for PAUSED messages
            if (sequence !== undefined) {
              const lastSeq = get().lastMessageSequence;
              if (sequence <= lastSeq) {
                return;
              }
              set({ lastMessageSequence: sequence });
            }
            set({ 
              isRunning: false, 
              timeRemaining: payload.timeRemaining,
              mode: payload.mode,
              currentIteration: payload.currentIteration,
              totalIterations: payload.totalIterations
            });
            break;

          case 'RESET':
            // Validate sequence for RESET messages
            if (sequence !== undefined) {
              const lastSeq = get().lastMessageSequence;
              if (sequence <= lastSeq) {
                return;
              }
              set({ lastMessageSequence: sequence });
            }
            // Worker confirms reset - ensure totalTime matches timeRemaining for correct circle animation
            const resetTotalTime = payload.totalTime ?? payload.timeRemaining;
            set({ 
              timeRemaining: payload.timeRemaining,
              totalTime: resetTotalTime,
              mode: payload.mode ?? 'work',
              currentIteration: payload.currentIteration ?? 1,
              totalIterations: payload.totalIterations ?? get().totalIterations,
              isRunning: false
            });
            break;

          case 'STATE_UPDATED':
            // Merge state update
            set(payload);
            break;

          case 'UPDATE_MODE':
            // Worker confirms mode update - ensure totalTime matches timeRemaining
            console.log('Store: Received UPDATE_MODE message:', { mode: payload.mode, iteration: payload.currentIteration, sequence });
            // Validate sequence for UPDATE_MODE messages to prevent stale updates
            if (sequence !== undefined) {
              const lastSeq = get().lastMessageSequence;
              if (sequence <= lastSeq) {
                console.log('Store: Ignoring stale UPDATE_MODE message, sequence:', sequence, 'lastSeq:', lastSeq);
                return;
              }
              set({ lastMessageSequence: sequence });
            }
            
            // Read current state to validate update
            const currentState = get();
            console.log('Store: Current state before UPDATE_MODE:', { mode: currentState.mode, iteration: currentState.currentIteration, isSkipping: currentState.isSkipping });
            const updateTimeRemaining = payload.timeRemaining || (
              payload.mode === 'work' 
                ? get().settings.workDuration * 60 
                : get().settings.breakDuration * 60
            );
            
            // Validate that this update makes sense (not going backwards)
            // If we're skipping, always accept the worker's confirmation (optimistic update was already applied)
            // Otherwise, validate that it's a forward progression
            const isSkipping = currentState.isSkipping;
            
            let isValidUpdate = false;
            if (isSkipping) {
              // When skipping, always accept worker confirmation - we've already optimistically updated the UI
              // The worker is just confirming what we set, so accept it regardless
              isValidUpdate = true;
            } else {
              // Not skipping - validate forward progression only
              isValidUpdate = 
                payload.mode !== currentState.mode || // Mode change is always valid
                (payload.mode === 'work' && payload.currentIteration >= currentState.currentIteration) || // Work: same or advancing
                (payload.mode === 'break' && payload.currentIteration === currentState.currentIteration); // Break: same iteration
            }
            
            if (!isValidUpdate) {
              console.warn('Store: Ignoring UPDATE_MODE that would move backwards:', {
                current: { mode: currentState.mode, iteration: currentState.currentIteration, isSkipping },
                payload: { mode: payload.mode, iteration: payload.currentIteration },
                sequence
              });
              // If we were skipping but validation failed, clear the flag to unblock the button
              if (isSkipping) {
                console.warn('Store: Clearing isSkipping flag due to validation failure');
                if (skipTimeoutId) {
                  clearTimeout(skipTimeoutId);
                  skipTimeoutId = null;
                }
                set({ isSkipping: false });
              }
              return;
            }
            
            // Update state with worker's confirmed values
            // When skipping, we only updated timeRemaining optimistically, so now update mode/iteration
            // This ensures the dot indicator only changes once when the state is confirmed
            if (isSkipping) {
              // Clear the timeout since we got the confirmation
              if (skipTimeoutId) {
                clearTimeout(skipTimeoutId);
                skipTimeoutId = null;
              }
              
              console.log('Store: Received UPDATE_MODE confirmation while skipping, updating mode/iteration');
              // We were skipping - update mode and iteration now (they weren't in optimistic update)
              set({
                mode: payload.mode,
                timeRemaining: updateTimeRemaining,
                totalTime: updateTimeRemaining, // Reset totalTime to match the new session duration
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations,
                isRunning: false,
                isSkipping: false // Clear skip flag when mode update is confirmed by worker
              });
              console.log('Store: Skip operation completed, isSkipping cleared');
            } else {
              // Not skipping, so this is a regular update
              const finalState = get();
              const valuesChanged = 
                finalState.mode !== payload.mode ||
                finalState.timeRemaining !== updateTimeRemaining ||
                finalState.totalTime !== updateTimeRemaining ||
                finalState.currentIteration !== payload.currentIteration ||
                finalState.totalIterations !== payload.totalIterations ||
                finalState.isRunning !== false;
              
              // Only update if values changed to prevent unnecessary re-renders
              if (valuesChanged) {
                set({
                  mode: payload.mode,
                  timeRemaining: updateTimeRemaining,
                  totalTime: updateTimeRemaining,
                  currentIteration: payload.currentIteration,
                  totalIterations: payload.totalIterations,
                  isRunning: false
                });
              }
            }
            break;

          case 'SETTINGS_UPDATED':
            set(state => ({ 
              settings: { ...state.settings, ...payload } 
            }));
            break;

          case 'COMPLETE':
            // Validate sequence for COMPLETE messages
            if (sequence !== undefined) {
              const lastSeq = get().lastMessageSequence;
              if (sequence <= lastSeq) {
                return;
              }
              set({ lastMessageSequence: sequence });
              
              // Resolve pending message if exists
              const pending = pendingMessages.get(sequence);
              if (pending) {
                pending.resolve();
                pendingMessages.delete(sequence);
              }
            }
            // Log practice time when we complete a work session (new mode is 'break' = we came from work)
            if (payload.mode === 'break') {
              const workSeconds = get().settings.workDuration * 60;
              addPracticeTime(workSeconds);
            }
            const newTimeRemaining = payload.timeRemaining || (
              payload.mode === 'work' 
                ? get().settings.workDuration * 60 
                : get().settings.breakDuration * 60
            );
            set({ 
              mode: payload.mode,
              currentIteration: payload.currentIteration,
              totalIterations: payload.totalIterations,
              isRunning: false,
              timeRemaining: newTimeRemaining,
              totalTime: newTimeRemaining // Reset totalTime to match the new session duration
            });
            // Trigger completion callback via custom event
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('timer-complete', { 
                detail: payload 
              }));
            }
            break;
            
          case 'PLAY_SOUND':
            // Handle sound playback - dispatch event for hook to handle
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('play-sound', {
                detail: payload
              }));
            }
            break;
            
          case 'PRACTICE_COMPLETE':
            // Validate sequence for PRACTICE_COMPLETE messages
            if (sequence !== undefined) {
              const lastSeq = get().lastMessageSequence;
              if (sequence <= lastSeq) {
                return;
              }
              set({ lastMessageSequence: sequence });
            }
            // Log practice time for the last work session
            const workSeconds = get().settings.workDuration * 60;
            addPracticeTime(workSeconds);
            // Don't set isPracticeComplete immediately - wait for sound to finish
            // The practice-complete event handler will play sound first, then set isPracticeComplete
            // Trigger completion callback via custom event (will handle sound first)
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('practice-complete', { 
                detail: { 
                  currentIteration: payload.currentIteration,
                  totalIterations: payload.totalIterations
                } 
              }));
            }
            break;
        }
      };
      
      addMessageHandler(messageHandler);
      set({ workerReady: true });
      isInitializing = false;
      initializationPromise = null;
      } catch (error) {
        console.error('Failed to initialize worker:', error);
        set({ workerReady: false });
        isInitializing = false;
        initializationPromise = null;
        throw error;
      }
    })();
    
    return initializationPromise;
  };
  
  // Clean up stale pending messages periodically
  setInterval(() => {
    const now = Date.now();
    for (const [seq, msg] of Array.from(pendingMessages.entries())) {
      if (now - msg.timestamp > 5000) {
        pendingMessages.delete(seq);
      }
    }
  }, 1000);

  return {
    // Initial state
    timeRemaining: DEFAULT_WORK_TIME,
    totalTime: DEFAULT_WORK_TIME,
    isRunning: false,
    mode: 'work',
    currentIteration: 1,
    totalIterations: savedSettings.iterations,
    isPracticeComplete: false,
    isSkipping: false,
    settings: savedSettings,
    workerReady: false,
    lastMessageSequence: 0,

    // Simple setters
    setTimeRemaining: (time) => set({ timeRemaining: time }),
    setTotalTime: (time) => set({ totalTime: time }),
    setIsRunning: (isRunning) => set({ isRunning }),
    setMode: (mode) => set({ mode }),
    setCurrentIteration: (iteration) => set({ currentIteration: iteration }),
    setTotalIterations: (iterations) => set({ totalIterations: iterations }),
    setIsPracticeComplete: (complete) => set({ isPracticeComplete: complete }),
    setSettings: (settings) => set({ settings }),
    setWorkerReady: (ready) => set({ workerReady: ready }),

    // Complex actions
    startTimer: async () => {
      const state = get();
      
      // Ensure worker is initialized
      if (!worker) {
        console.warn('Store: Worker not initialized, initializing now...');
        try {
          await initializeWorker();
        } catch (error) {
          console.error('Store: Failed to initialize worker:', error);
          return;
        }
      }
      
      // Double-check worker is ready
      if (!worker) {
        console.error('Store: Worker still not available after initialization');
        return;
      }
      
      if (state.isRunning) {
        console.log('Store: Timer already running');
        return;
      }
      
      // Validate timeRemaining
      if (state.timeRemaining <= 0) {
        console.warn('Store: Cannot start timer - timeRemaining is 0 or negative:', state.timeRemaining);
        return;
      }
      
      console.log('Store: Starting timer with state:', {
        timeRemaining: state.timeRemaining,
        mode: state.mode,
        currentIteration: state.currentIteration,
        totalIterations: state.totalIterations,
        workerReady: state.workerReady
      });
      
      try {
        await sendMessage('START', {
          timeRemaining: state.timeRemaining,
          mode: state.mode,
          currentIteration: state.currentIteration,
          totalIterations: state.totalIterations
        });
        
        set({ isRunning: true });
        console.log('Store: Timer start message sent, isRunning set to true');
      } catch (error) {
        console.error('Store: Error sending START message:', error);
      }
    },

    pauseTimer: async () => {
      const state = get();
      if (!worker || !state.isRunning) return;
      
      await sendMessage('PAUSE');
      set({ isRunning: false });
    },

    resetTimer: async () => {
      const state = get();
      if (!worker) return;
      
      // Reset always goes to first work session (not "reset current session")
      const workDurationSeconds = state.settings.workDuration * 60;
      const totalIterations = state.settings.iterations ?? 4;
      
      await sendMessage('RESET', {
        timeRemaining: workDurationSeconds,
        mode: 'work',
        currentIteration: 1,
        totalIterations
      });
      
      set({
        isRunning: false,
        mode: 'work',
        currentIteration: 1,
        timeRemaining: workDurationSeconds,
        totalTime: workDurationSeconds,
        isPracticeComplete: false
      });
    },

    skipTimer: async () => {
      // Prevent concurrent skip operations
      const currentState = get();
      if (currentState.isSkipping) {
        console.log('Store: Skip already in progress, ignoring duplicate request');
        return;
      }
      
      console.log('Store: Starting skip operation');
      // Set flag to prevent concurrent operations
      set({ isSkipping: true });
      
      // Set a timeout to clear the flag if worker doesn't respond (fallback safety)
      // Clear any existing timeout first
      if (skipTimeoutId) {
        clearTimeout(skipTimeoutId);
        skipTimeoutId = null;
      }
      
      const clearSkipFlag = () => {
        const state = get();
        if (state.isSkipping) {
          console.warn('Store: Timeout waiting for worker UPDATE_MODE confirmation, clearing isSkipping flag');
          set({ isSkipping: false });
        }
        skipTimeoutId = null;
      };
      skipTimeoutId = setTimeout(clearSkipFlag, 2000); // 2 second timeout
      
      try {
        // Read fresh state right before processing to avoid stale data
        const state = get();
        if (!worker) {
          if (skipTimeoutId) {
            clearTimeout(skipTimeoutId);
            skipTimeoutId = null;
          }
          set({ isSkipping: false });
          return;
        }
        
        // Pause timer first if running
        if (state.isRunning) {
          await sendMessage('PAUSE');
          // Wait a bit for pause to complete
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Re-read state after pause to ensure we have latest values
        const freshState = get();
        
        if (freshState.mode === 'work') {
          // Check if this is the last work session
          if (freshState.currentIteration === freshState.totalIterations) {
            if (skipTimeoutId) {
              clearTimeout(skipTimeoutId);
              skipTimeoutId = null;
            }
            set({
              isPracticeComplete: true,
              isRunning: false,
              isSkipping: false
            });
            return;
          }
          
          // Go to break mode
          const newTimeRemaining = freshState.settings.breakDuration * 60;
          console.log('Store: Sending UPDATE_MODE to break, iteration:', freshState.currentIteration);
          await sendMessage('UPDATE_MODE', {
            mode: 'break',
            timeRemaining: newTimeRemaining,
            currentIteration: freshState.currentIteration,
            totalIterations: freshState.totalIterations,
            isRunning: false
          });
          
          // Only optimistically update timeRemaining - wait for worker confirmation for mode/iteration
          // This prevents the dot indicator from glitching during the transition
          set({
            timeRemaining: newTimeRemaining,
            totalTime: newTimeRemaining,
            isRunning: false
            // Don't update mode/currentIteration here - wait for worker confirmation
            // Don't clear isSkipping here - wait for worker confirmation (or timeout)
          });
        } else {
          // After break, increment iteration and go to work
          const nextIteration = freshState.currentIteration + 1;
          const newIteration = nextIteration > freshState.totalIterations ? 1 : nextIteration;
          const newTimeRemaining = freshState.settings.workDuration * 60;
          
          console.log('Store: Sending UPDATE_MODE to work, iteration:', newIteration);
          await sendMessage('UPDATE_MODE', {
            mode: 'work',
            timeRemaining: newTimeRemaining,
            currentIteration: newIteration,
            totalIterations: freshState.totalIterations,
            isRunning: false
          });
          
          // Only optimistically update timeRemaining - wait for worker confirmation for mode/iteration
          // This prevents the dot indicator from glitching during the transition
          set({
            timeRemaining: newTimeRemaining,
            totalTime: newTimeRemaining,
            isRunning: false
            // Don't update mode/currentIteration here - wait for worker confirmation
            // Don't clear isSkipping here - wait for worker confirmation
          });
        }
      } catch (error) {
        if (skipTimeoutId) {
          clearTimeout(skipTimeoutId);
          skipTimeoutId = null;
        }
        console.error('Error in skipTimer:', error);
        set({ isSkipping: false });
      }
      
      // Store timeout ID in a way that UPDATE_MODE handler can clear it
      // We'll clear it when UPDATE_MODE is received
      // For now, the timeout will check if isSkipping is still true before clearing
    },

    completeSession: async () => {
      // This is now just an alias for skipTimer logic
      await get().skipTimer();
    },

    startNewSession: async () => {
      await get().resetTimer();
    },

    initializeWorker
  };
});
