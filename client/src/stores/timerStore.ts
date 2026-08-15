import { create } from 'zustand';
import { SettingsType, DEFAULT_SETTINGS } from '@/lib/timerService';
import { getSettings, getTimerProgress, saveTimerProgress, clearTimerProgress } from '@/lib/localStorage';
import { addPracticeTime, addDetailedPracticeTime, getPiecePracticedSeconds, logSegmentCompletion } from '@/lib/practiceLog';
import { getPracticePlan, practicePlanApi } from '@/lib/practicePlan';
import { scheduleUserDataPush } from '@/lib/userDataSync';
import { getTimerWorker, addMessageHandler, removeMessageHandler } from '@/lib/timerWorkerSingleton';
import { playSound, resumeAudioContext } from '@/lib/soundEffects';

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
  activePieceId: string | null;
  activePieceName: string | null;
  pieceTimeRemaining: number;
  pieceTotalTime: number;
  isPiecePaused: boolean;
  isPieceOvertime: boolean;      // piece has time remaining after the work session ended
  pieceOvertimeRunning: boolean; // the piece-only interval is actively counting
  audioInitialized: boolean;

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
  setActivePiece: (id: string | null, name: string | null) => void;
  selectPiece: (id: string, name: string, allocatedMinutes: number, period: 'day' | 'week') => void;
  clearPiece: () => void;
  togglePausePiece: () => void;
  setAudioInitialized: (initialized: boolean) => void;
  startPieceOvertime: () => void | Promise<void>;
  stopPieceOvertime: () => void;

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

// Rehydrate timer progress from localStorage (always restored as paused)
const savedProgress = getTimerProgress();

// Sanitize savedProgress if it holds a corrupt/desynchronized state (e.g. break mode with work duration timeRemaining)
let initialMode: 'work' | 'break' = (savedProgress?.mode ?? 'work') as 'work' | 'break';
let initialTimeRemaining = savedProgress?.timeRemaining ?? DEFAULT_WORK_TIME;
let initialTotalTime = savedProgress?.totalTime ?? initialTimeRemaining;

if (savedProgress && !savedProgress.isPracticeComplete) {
  const workSec = savedSettings.workDuration * 60;
  const breakSec = savedSettings.breakDuration * 60;

  if (initialMode === 'break' && initialTimeRemaining > breakSec) {
    initialTimeRemaining = breakSec;
    initialTotalTime = breakSec;
  } else if (initialMode === 'work' && initialTimeRemaining > workSec) {
    initialTimeRemaining = workSec;
    initialTotalTime = workSec;
  }
}

/** Persist current timer progress snapshot to localStorage */
function persistProgress(state: {
  timeRemaining: number;
  totalTime: number;
  mode: 'work' | 'break';
  currentIteration: number;
  totalIterations: number;
  isPracticeComplete: boolean;
}) {
  saveTimerProgress({
    timeRemaining: state.timeRemaining,
    totalTime: state.totalTime,
    mode: state.mode,
    currentIteration: state.currentIteration,
    totalIterations: state.totalIterations,
    isPracticeComplete: state.isPracticeComplete,
  });
}

// Global flag to prevent duplicate initialization (React StrictMode causes double renders in dev)
let isInitializing = false;
let initializationPromise: Promise<void> | null = null;

export const useTimerStore = create<TimerState>((baseSet, get) => {
  let worker: Worker | null = null;
  let messageHandler: ((event: MessageEvent) => void) | null = null;

  // Message sequencing to prevent race conditions
  let messageSequence = 0;
  const pendingMessages = new Map<number, { timestamp: number; resolve: () => void; type: string; payload?: any }>();

  // Track skip timeout to clear it when UPDATE_MODE is received
  let skipTimeoutId: NodeJS.Timeout | null = null;

  // Post PIECE_TICK_STOP to the worker so it stops emitting piece ticks.
  // Guarded so it's a no-op when the worker hasn't been initialized yet.
  const stopWorkerPieceTicks = () => {
    if (worker) {
      worker.postMessage({ type: 'PIECE_TICK_STOP' });
    }
  };

  // Shadow set to automatically derive isPieceOvertime and manage pieceOvertimeRunning
  const set = (
    partial: TimerState | Partial<TimerState> | ((state: TimerState) => TimerState | Partial<TimerState>),
    replace?: boolean
  ) => {
    baseSet((state) => {
      const nextState = typeof partial === 'function' ? partial(state) : partial;

      const newMode = nextState.mode !== undefined ? nextState.mode : state.mode;
      const newActivePieceId = nextState.activePieceId !== undefined ? nextState.activePieceId : state.activePieceId;
      const newIsRunning = nextState.isRunning !== undefined ? nextState.isRunning : state.isRunning;
      const nextIsPracticeComplete = nextState.isPracticeComplete !== undefined ? nextState.isPracticeComplete : state.isPracticeComplete;

      // Calculate isPieceOvertime: true if we are on a break (or practice is fully complete)
      // and have an active piece selected
      const nextIsPieceOvertime = (newMode === 'break' || nextIsPracticeComplete) && newActivePieceId !== null;

      // If we are no longer in overtime, stop piece overtime running.
      // When the main timer is running (break mode), piece overtime can run concurrently.
      let nextPieceOvertimeRunning = nextState.pieceOvertimeRunning !== undefined
        ? nextState.pieceOvertimeRunning
        : state.pieceOvertimeRunning;

      if (!nextIsPieceOvertime) {
        // Leaving overtime — ensure the worker's piece ticker is stopped and the
        // running flag is cleared.
        if (state.pieceOvertimeRunning || nextPieceOvertimeRunning) {
          stopWorkerPieceTicks();
        }
        nextPieceOvertimeRunning = false;
      }

      return {
        ...nextState,
        isPieceOvertime: nextIsPieceOvertime,
        pieceOvertimeRunning: nextPieceOvertimeRunning
      } as any;
    }, replace as any);
  };

  /**
   * Attribute `diff` seconds of practice time to whatever the user is currently
   * doing. Shared between the main-timer TICK path (during work sessions),
   * setTimeRemaining (iOS background timer restore path), and the worker-driven
   * PIECE_TICK path (segment overtime).
   *
   * Behavior:
   *   - No active piece → adds `diff` to general practice time.
   *   - Active piece but paused → adds `diff` to general practice time only
   *     (piece countdown untouched).
   *   - Active piece, not paused → records detailed practice time on the piece
   *     (which also adds to general), decrements pieceTimeRemaining, and on
   *     reaching 0 records segment completion, checks the plan item, fires the
   *     `piece-timer-complete` event, and clears the active piece.
   */
  const attributePracticeTime = (diff: number) => {
    if (diff <= 0) return;
    const s = get();

    if (!s.activePieceId) {
      addPracticeTime(diff);
      return;
    }

    if (s.isPiecePaused) {
      addPracticeTime(diff);
      return;
    }

    const pieceName = s.activePieceName && s.activePieceName.trim() ? s.activePieceName : 'Untitled segment';

    // Records to piece detail AND general practice time (see addDetailedPracticeTime)
    addDetailedPracticeTime(s.activePieceId, pieceName, diff);

    if (s.pieceTimeRemaining <= 0) return;

    const nextPieceTime = Math.max(0, s.pieceTimeRemaining - diff);
    set({ pieceTimeRemaining: nextPieceTime });

    if (nextPieceTime === 0) {
      logSegmentCompletion(s.activePieceId);
      practicePlanApi.checkItem(getPracticePlan(), s.activePieceId);
      scheduleUserDataPush();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('piece-timer-complete', {
          detail: { name: s.activePieceName, id: s.activePieceId }
        }));
      }

      set({
        activePieceId: null,
        activePieceName: null,
        pieceTimeRemaining: 0,
        pieceTotalTime: 0,
        isPiecePaused: false
      });
    }
  };

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

        // If we restored progress from localStorage, sync the worker to the restored state
        // so it starts from the right mode/iteration/timeRemaining instead of defaults.
        if (savedProgress && !savedProgress.isPracticeComplete) {
          await sendMessage('UPDATE_MODE', {
            mode: initialMode,
            timeRemaining: initialTimeRemaining,
            currentIteration: savedProgress.currentIteration,
            totalIterations: savedProgress.totalIterations,
            isRunning: false
          });
        }

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

              // Log elapsed time if we are in work mode and it's a valid tick down.
              // Skip piece logging when isPieceOvertime — the worker-driven PIECE_TICK owns that.
              const oldState = get();
              const isWorkMode = oldState.mode === 'work' || payload.mode === 'work';
              if (isWorkMode && !oldState.isPieceOvertime && oldState.timeRemaining > payload.timeRemaining) {
                const diff = oldState.timeRemaining - payload.timeRemaining;
                attributePracticeTime(diff);
              }

              // Update state with new timeRemaining
              set({
                timeRemaining: payload.timeRemaining,
                mode: payload.mode,
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations
              });
              // Persist progress on every tick
              persistProgress({
                timeRemaining: payload.timeRemaining,
                totalTime: get().totalTime,
                mode: payload.mode,
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations,
                isPracticeComplete: get().isPracticeComplete,
              });
              break;

            case 'PAUSED':
              // Validate sequence for PAUSED messages
              if (sequence !== undefined) {
                const lastSeq = get().lastMessageSequence;
                // Ignore stale PAUSED messages if sequence is <= lastSeq OR if a newer outgoing message was sent (e.g. START)
                if (sequence <= lastSeq || sequence < messageSequence) {
                  return;
                }
                set({ lastMessageSequence: sequence });
              }

              // Double check: if user called startTimer after this pause was generated, do not pause
              if (get().isRunning && sequence !== undefined && sequence < messageSequence) {
                return;
              }

              set({
                isRunning: false,
                timeRemaining: payload.timeRemaining,
                mode: payload.mode,
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations
              });
              // Persist progress when paused
              persistProgress({
                timeRemaining: payload.timeRemaining,
                totalTime: get().totalTime,
                mode: payload.mode,
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations,
                isPracticeComplete: get().isPracticeComplete,
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
              if (sequence !== undefined) {
                const lastSeq = get().lastMessageSequence;
                if (sequence <= lastSeq) {
                  console.log('Store: Ignoring stale UPDATE_MODE message, sequence:', sequence, 'lastSeq:', lastSeq);
                  return;
                }
                set({ lastMessageSequence: sequence });
              }

              if (skipTimeoutId) {
                clearTimeout(skipTimeoutId);
                skipTimeoutId = null;
              }

              const updateTimeRemaining = payload.timeRemaining ?? (
                payload.mode === 'work'
                  ? get().settings.workDuration * 60
                  : get().settings.breakDuration * 60
              );

              set({
                mode: payload.mode,
                timeRemaining: updateTimeRemaining,
                totalTime: updateTimeRemaining,
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations,
                isRunning: false,
                isSkipping: false
              });

              // Persist progress after mode/iteration update
              persistProgress({
                timeRemaining: updateTimeRemaining,
                totalTime: updateTimeRemaining,
                mode: payload.mode,
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations,
                isPracticeComplete: get().isPracticeComplete,
              });
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

              // Stop running state & transition to completed mode from worker payload
              const completeTimeRemaining = payload.timeRemaining || (
                payload.mode === 'work'
                  ? get().settings.workDuration * 60
                  : get().settings.breakDuration * 60
              );

              set({
                isRunning: false,
                mode: payload.mode,
                timeRemaining: completeTimeRemaining,
                totalTime: completeTimeRemaining,
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations,
                isSkipping: false
              });

              persistProgress({
                timeRemaining: completeTimeRemaining,
                totalTime: completeTimeRemaining,
                mode: payload.mode,
                currentIteration: payload.currentIteration,
                totalIterations: payload.totalIterations,
                isPracticeComplete: get().isPracticeComplete,
              });

              // Trigger completion callback via custom event
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('timer-complete', {
                  detail: payload
                }));
              }

              // If a piece segment still has time remaining after the work session
              // ended, activate overtime mode so the user can continue the segment.
              if (get().pieceTimeRemaining > 0 && get().activePieceId) {
                set({ isPieceOvertime: true });
              }
              break;

            case 'PLAY_SOUND':
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('play-sound', {
                  detail: payload
                }));
              }
              // Always trigger audio playback from store to guarantee audio on all pages
              (async () => {
                try {
                  await resumeAudioContext();
                  const storeSettings = get().settings;
                  if (storeSettings.soundEnabled) {
                    let vol = payload?.volume ?? storeSettings.volume;
                    if (vol <= 1) vol = vol * 100;
                    vol = Math.min(100, Math.max(0, vol));
                    const beeps = payload?.numberOfBeeps ?? storeSettings.numberOfBeeps;
                    const soundType = payload?.soundType ?? storeSettings.soundType;
                    if (vol > 0) {
                      await playSound('end', beeps, vol, soundType as any);
                    }
                  }
                } catch (e) {
                  console.error('[timerStore] Error playing PLAY_SOUND audio:', e);
                }
              })();
              break;

            case 'PRACTICE_COMPLETE':
              if (sequence !== undefined) {
                const lastSeq = get().lastMessageSequence;
                if (sequence > lastSeq) {
                  set({ lastMessageSequence: sequence });
                }
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('practice-complete', {
                  detail: {
                    currentIteration: payload.currentIteration,
                    totalIterations: payload.totalIterations
                  }
                }));
              }
              // Always play practice completion sound directly from store
              (async () => {
                try {
                  await resumeAudioContext();
                  const storeSettings = get().settings;
                  if (storeSettings.soundEnabled) {
                    let vol = storeSettings.volume;
                    if (vol <= 1) vol = vol * 100;
                    vol = Math.min(100, Math.max(0, vol));
                    if (vol > 0) {
                      await playSound('end', storeSettings.numberOfBeeps, vol, storeSettings.soundType as any);
                    }
                  }
                } catch (e) {
                  console.error('[timerStore] Error playing PRACTICE_COMPLETE sound:', e);
                }
              })();
              set({ isPracticeComplete: true, isRunning: false });
              saveTimerProgress({
                timeRemaining: get().timeRemaining,
                totalTime: get().totalTime,
                mode: get().mode,
                currentIteration: get().currentIteration,
                totalIterations: get().totalIterations,
                isPracticeComplete: true,
              });
              break;

            case 'PIECE_TICK':
              // Worker-driven segment-overtime tick. Ignored if overtime has been
              // stopped in the meantime (stopPieceOvertime already messaged the
              // worker but a tick was already in flight).
              if (get().pieceOvertimeRunning) {
                attributePracticeTime(1);
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
    // Initial state — rehydrate from localStorage if available, otherwise use defaults
    timeRemaining: initialTimeRemaining,
    totalTime: initialTotalTime,
    isRunning: false, // always restore as paused
    mode: initialMode,
    currentIteration: savedProgress?.currentIteration ?? 1,
    totalIterations: savedProgress?.totalIterations ?? savedSettings.iterations,
    isPracticeComplete: savedProgress?.isPracticeComplete ?? false,
    isSkipping: false,
    settings: savedSettings,
    workerReady: false,
    lastMessageSequence: 0,
    activePieceId: null,
    activePieceName: null,
    pieceTimeRemaining: 0,
    pieceTotalTime: 0,
    isPiecePaused: false,
    isPieceOvertime: false,
    pieceOvertimeRunning: false,
    audioInitialized: false,

    // Simple setters
    setTimeRemaining: (time) => {
      const state = get();
      if (state.mode === 'work' && state.isRunning && state.timeRemaining > time) {
        const diff = state.timeRemaining - time;
        attributePracticeTime(diff);
      }
      set({ timeRemaining: time });
    },
    setTotalTime: (time) => set({ totalTime: time }),
    setIsRunning: (isRunning) => set({ isRunning }),
    setMode: (mode) => set({ mode }),
    setCurrentIteration: (iteration) => set({ currentIteration: iteration }),
    setTotalIterations: (iterations) => set({ totalIterations: iterations }),
    setIsPracticeComplete: (complete) => set({ isPracticeComplete: complete }),
    setSettings: (settings) => {
      // Sync totalIterations from settings.iterations so the displayed goal
      // always matches what the user configured. Don't change mid-session
      // (while running) to avoid moving the goalpost on an active timer.
      const state = get();
      const updates: Partial<TimerState> = { settings };
      if (!state.isRunning) {
        updates.totalIterations = settings.iterations ?? state.totalIterations;

        if (state.mode === 'break') {
          const newBreakSec = settings.breakDuration * 60;
          const oldBreakSec = state.settings.breakDuration * 60;
          if (state.timeRemaining === oldBreakSec || state.timeRemaining === state.totalTime || state.timeRemaining > newBreakSec) {
            updates.timeRemaining = newBreakSec;
            updates.totalTime = newBreakSec;
          }
        } else if (state.mode === 'work') {
          const newWorkSec = settings.workDuration * 60;
          const oldWorkSec = state.settings.workDuration * 60;
          if (state.timeRemaining === oldWorkSec || state.timeRemaining === state.totalTime || state.timeRemaining > newWorkSec) {
            updates.timeRemaining = newWorkSec;
            updates.totalTime = newWorkSec;
          }
        }
      }
      set(updates);

      // Persist the updated timer progress to localStorage
      const freshState = get();
      persistProgress({
        timeRemaining: freshState.timeRemaining,
        totalTime: freshState.totalTime,
        mode: freshState.mode,
        currentIteration: freshState.currentIteration,
        totalIterations: freshState.totalIterations,
        isPracticeComplete: freshState.isPracticeComplete,
      });

      if (worker) {
        sendMessage('UPDATE_SETTINGS', settings).catch(() => {});
        if (!freshState.isRunning) {
          sendMessage('UPDATE_MODE', {
            mode: freshState.mode,
            timeRemaining: freshState.timeRemaining,
            currentIteration: freshState.currentIteration,
            totalIterations: freshState.totalIterations,
            isRunning: false
          }).catch(() => {});
        }
      }
    },
    setWorkerReady: (ready) => set({ workerReady: ready }),
    setActivePiece: (id, name) => set({ activePieceId: id, activePieceName: name }),

    // Complex actions
    startTimer: async () => {
      // Piece overtime runs concurrently with the break timer — don't stop it here.
      // (It will stop naturally when the piece finishes or when overtime state is cleared.)

      // Unlock AudioContext on user interaction gesture
      await resumeAudioContext().catch((e) =>
        console.warn('[timerStore] AudioContext unlock failed on startTimer:', e)
      );

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

      // Defensive check: ensure mode and timeRemaining are consistent before starting worker
      let effectiveMode = state.mode;
      const workSec = state.settings.workDuration * 60;
      const breakSec = state.settings.breakDuration * 60;

      if (state.mode === 'break' && state.timeRemaining > breakSec) {
        effectiveMode = 'break';
        set({ timeRemaining: breakSec, totalTime: breakSec });
      } else if (state.mode === 'work' && state.timeRemaining <= breakSec && breakSec < workSec && state.timeRemaining === breakSec) {
        console.warn('Store startTimer: mode was work but timeRemaining matches break duration. Correcting mode to break.');
        effectiveMode = 'break';
        set({ mode: 'break' });
      }

      console.log('Store: Starting timer with state:', {
        timeRemaining: state.timeRemaining,
        mode: effectiveMode,
        currentIteration: state.currentIteration,
        totalIterations: state.totalIterations,
        workerReady: state.workerReady
      });

      try {
        await sendMessage('START', {
          timeRemaining: state.timeRemaining,
          mode: effectiveMode,
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

      // Stop piece overtime if active
      stopWorkerPieceTicks();

      set({
        isRunning: false,
        mode: 'work',
        currentIteration: 1,
        timeRemaining: workDurationSeconds,
        totalTime: workDurationSeconds,
        isPracticeComplete: false,
        isPieceOvertime: false,
        pieceOvertimeRunning: false
      });
      // Clear saved progress so next refresh starts fresh
      clearTimerProgress();
    },

    skipTimer: async () => {
      // Prevent concurrent skip operations
      const currentState = get();
      if (currentState.isSkipping) {
        console.log('Store: Skip already in progress, ignoring duplicate request');
        return;
      }

      console.log('Store: Starting skip operation');
      set({ isSkipping: true });

      // Clear any existing timeout first
      if (skipTimeoutId) {
        clearTimeout(skipTimeoutId);
        skipTimeoutId = null;
      }

      // Fast safety timeout to ensure isSkipping never stays true
      skipTimeoutId = setTimeout(() => {
        set({ isSkipping: false });
        skipTimeoutId = null;
      }, 300);

      try {
        if (!worker) {
          console.warn('Store: Worker not initialized in skipTimer, initializing now...');
          try {
            await initializeWorker();
          } catch (error) {
            console.error('Store: Failed to initialize worker:', error);
          }
        }

        const state = get();

        // Pause timer first if running
        if (state.isRunning) {
          if (worker) {
            await sendMessage('PAUSE');
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        // Re-read state after pause to ensure we have latest values
        const freshState = get();

        if (freshState.mode === 'work') {
          // Check if this is the last work session
          if (freshState.currentIteration === freshState.totalIterations) {
            stopWorkerPieceTicks();
            set({
              isPracticeComplete: true,
              isRunning: false,
              isSkipping: false,
              isPieceOvertime: false,
              pieceOvertimeRunning: false
            });
            clearTimerProgress();
            return;
          }

          // Go to break mode
          const newTimeRemaining = freshState.settings.breakDuration * 60;
          console.log('Store: Transitioning to break, iteration:', freshState.currentIteration);

          // Update store state atomically with consistent mode and duration
          set({
            mode: 'break',
            timeRemaining: newTimeRemaining,
            totalTime: newTimeRemaining,
            currentIteration: freshState.currentIteration,
            isRunning: false,
            isSkipping: false
          });

          persistProgress({
            timeRemaining: newTimeRemaining,
            totalTime: newTimeRemaining,
            mode: 'break',
            currentIteration: freshState.currentIteration,
            totalIterations: freshState.totalIterations,
            isPracticeComplete: false,
          });

          if (worker) {
            await sendMessage('UPDATE_MODE', {
              mode: 'break',
              timeRemaining: newTimeRemaining,
              currentIteration: freshState.currentIteration,
              totalIterations: freshState.totalIterations,
              isRunning: false
            });
          }
        } else {
          // After break, increment iteration and go to work
          const nextIteration = freshState.currentIteration + 1;
          const newIteration = nextIteration > freshState.totalIterations ? 1 : nextIteration;
          const newTimeRemaining = freshState.settings.workDuration * 60;

          console.log('Store: Transitioning to work, iteration:', newIteration);

          stopWorkerPieceTicks();

          // Update store state atomically with consistent mode and duration
          set({
            mode: 'work',
            timeRemaining: newTimeRemaining,
            totalTime: newTimeRemaining,
            currentIteration: newIteration,
            isRunning: false,
            isPieceOvertime: false,
            pieceOvertimeRunning: false,
            isSkipping: false
          });

          persistProgress({
            timeRemaining: newTimeRemaining,
            totalTime: newTimeRemaining,
            mode: 'work',
            currentIteration: newIteration,
            totalIterations: freshState.totalIterations,
            isPracticeComplete: false,
          });

          if (worker) {
            await sendMessage('UPDATE_MODE', {
              mode: 'work',
              timeRemaining: newTimeRemaining,
              currentIteration: newIteration,
              totalIterations: freshState.totalIterations,
              isRunning: false
            });
          }
        }
      } catch (error) {
        console.error('Error in skipTimer:', error);
      } finally {
        setTimeout(() => {
          set({ isSkipping: false });
        }, 150);
      }
    },

    completeSession: async () => {
      // This is now just an alias for skipTimer logic
      await get().skipTimer();
    },

    startNewSession: async () => {
      await get().resetTimer();
    },

    selectPiece: (id, name, allocatedMinutes, _period) => {
      const targetSeconds = (allocatedMinutes || 15) * 60;
      const pieceName = name && name.trim() ? name : 'Untitled segment';
      set({
        activePieceId: id,
        activePieceName: pieceName,
        pieceTimeRemaining: targetSeconds,
        pieceTotalTime: targetSeconds,
        isPiecePaused: false
      });
    },

    clearPiece: () => {
      // Stop overtime ticker if running
      stopWorkerPieceTicks();
      set({
        activePieceId: null,
        activePieceName: null,
        pieceTimeRemaining: 0,
        pieceTotalTime: 0,
        isPiecePaused: false,
        isPieceOvertime: false,
        pieceOvertimeRunning: false
      });
    },

    startPieceOvertime: async () => {
      const state = get();
      if (!state.activePieceId) return;

      // The break timer may be running concurrently in the worker — do not pause it.
      // Ensure the piece isn't in the "paused" state (which would skip piece
      // attribution in attributePracticeTime). During overtime, the play/pause
      // UI toggles the ticker itself, not this flag.
      set({ pieceOvertimeRunning: true, isPiecePaused: false });

      if (typeof window !== 'undefined') {
        try {
          await resumeAudioContext();
        } catch (e) {
          console.error('[timerStore] Error resuming AudioContext in startPieceOvertime:', e);
        }
      }

      // Ask the worker to start emitting PIECE_TICK once per second. The store's
      // message handler decrements pieceTimeRemaining on each tick via
      // attributePracticeTime, which also handles piece completion.
      if (worker) {
        worker.postMessage({ type: 'PIECE_TICK_START' });
      }
    },

    stopPieceOvertime: () => {
      stopWorkerPieceTicks();
      set({ pieceOvertimeRunning: false });
    },

    togglePausePiece: () => {
      set((state) => ({ isPiecePaused: !state.isPiecePaused }));
    },

    setAudioInitialized: (initialized) => {
      set({ audioInitialized: initialized });
    },

    initializeWorker
  };
});
