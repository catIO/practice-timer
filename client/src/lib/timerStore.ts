import { create } from 'zustand';
import { TimerState, getTimerWorker, updateWorkerState } from './timerWorkerSingleton';

interface TimerStore extends TimerState {
  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  updateSettings: (settings: Partial<TimerState['settings']>) => void;
}

interface WorkerMessage {
  type: 'TICK' | 'PAUSED' | 'RESET' | 'STATE_UPDATED' | 'SETTINGS_UPDATED' | 'COMPLETE';
  payload: any;
}

export const useTimerStore = create<TimerStore>((set, get) => {
  // Set up message handling
  let worker: Worker | null = null;
  
  // Initialize worker
  getTimerWorker().then(w => {
    worker = w;
    worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'TICK':
          set({ timeRemaining: payload.timeRemaining });
          break;

        case 'PAUSED':
          set({ isRunning: false, timeRemaining: payload.timeRemaining });
          break;

        case 'RESET':
          set({ timeRemaining: payload.timeRemaining });
          break;

        case 'STATE_UPDATED':
          set(payload);
          break;

        case 'SETTINGS_UPDATED':
          set(state => ({ settings: { ...state.settings, ...payload } }));
          break;

        case 'COMPLETE':
          set({ 
            mode: payload.mode,
            currentIteration: payload.currentIteration,
            totalIterations: payload.totalIterations,
            timeRemaining: payload.mode === 'work' ? get().settings.workDuration * 60 : get().settings.breakDuration * 60
          });
          break;
      }
    });
  });

  return {
    // Initial state
    timeRemaining: 25 * 60,
    isRunning: false,
    mode: 'work',
    currentIteration: 1,
    totalIterations: 4,
    settings: {
      workDuration: 25 * 60,
      breakDuration: 5 * 60,
      iterations: 4,
      soundEnabled: true,
      browserNotificationsEnabled: true,
      darkMode: false,
      numberOfBeeps: 3,
      mode: 'work',
      volume: 0.5,
      soundType: 'beep'
    },

    // Actions
    start: () => {
      if (worker) {
        worker.postMessage({ type: 'START' });
        set({ isRunning: true });
      }
    },

    pause: () => {
      if (worker) {
        worker.postMessage({ type: 'PAUSE' });
        set({ isRunning: false });
      }
    },

    reset: () => {
      if (worker) {
        worker.postMessage({ type: 'RESET' });
        set({ 
          timeRemaining: get().mode === 'work' ? get().settings.workDuration : get().settings.breakDuration,
          isRunning: false 
        });
      }
    },

    updateSettings: (newSettings) => {
      if (worker) {
        worker.postMessage({ 
          type: 'UPDATE_SETTINGS', 
          payload: newSettings 
        });
        set(state => ({
          settings: { ...state.settings, ...newSettings }
        }));
      }
    }
  };
}); 