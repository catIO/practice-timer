// Timer Web Worker
import { TimerState } from '../lib/timerWorkerSingleton';

let workerId: string | null = null;
let timerInterval: number | null = null;
let startTime: number | null = null;
let targetEndTime: number | null = null;

// Worker state
let state: TimerState = {
  timeRemaining: 0,
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
  }
};

// Log when worker is created
console.log('Timer Worker created');

function updateTimer() {
  console.log('Worker: updateTimer called, timeRemaining:', state.timeRemaining);
  if (state.timeRemaining > 0) {
    state.timeRemaining--;
    console.log('Worker: Sending TICK with timeRemaining:', state.timeRemaining);
    self.postMessage({ 
      type: 'TICK', 
      payload: state
    });
  } else {
    console.log('Worker: Timer complete');
    state.isRunning = false;
    if (timerInterval) {
      self.clearInterval(timerInterval);
      timerInterval = null;
    }
    self.postMessage({ 
      type: 'COMPLETE',
      payload: state
    });
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event: MessageEvent) => {
  const { type, payload } = event.data;
  console.log('Worker received message:', type, payload);

  switch (type) {
    case 'INIT':
      console.log('Worker: Initializing with settings:', payload);
      workerId = payload.workerId;
      self.postMessage({
        type: 'INIT_COMPLETE',
        payload: {
          workerId,
          ...state
        }
      });
      break;

    case 'START':
      console.log('Worker: Starting timer');
      startTimer();
      break;

    case 'PAUSE':
      console.log('Worker: Pausing timer');
      pauseTimer();
      break;

    case 'RESET':
      console.log('Worker: Resetting timer');
      resetTimer();
      break;

    case 'UPDATE_STATE':
      console.log('Worker: Updating state:', payload);
      updateState(payload);
      break;

    case 'UPDATE_SETTINGS':
      console.log('Worker: Updating settings:', payload);
      updateSettings(payload);
      break;

    case 'UPDATE_TIME':
      console.log('Worker: Updating time to:', payload.timeRemaining);
      updateTime(payload.timeRemaining);
      break;

    case 'UPDATE_MODE':
      console.log('Worker: Updating mode to:', payload.mode);
      updateMode(payload.mode, payload.timeRemaining, payload.currentIteration, payload.totalIterations);
      break;

    case 'SYNC_STATE':
      console.log('Worker: Syncing state from main thread:', payload);
      // Sync state without interfering with running timer
      if (!state.isRunning) {
        state.timeRemaining = payload.timeRemaining;
        state.mode = payload.mode;
        state.currentIteration = payload.currentIteration;
        state.totalIterations = payload.totalIterations;
        state.isRunning = payload.isRunning;
      } else {
        console.log('Worker: Timer is running, preserving current state');
      }
      break;

    default:
      console.warn('Worker: Unknown message type:', type);
  }

  // Log current state after handling message
  console.log('Worker: Current state:', state);
});

// Update the worker's state
function updateState(newState: Partial<TimerState>) {
  console.log('Worker: Updating state:', newState);
  
  // Don't update timeRemaining if timer is running to prevent interference
  if (newState.timeRemaining !== undefined && !state.isRunning) {
    console.log('Worker: Updating timeRemaining from', state.timeRemaining, 'to', newState.timeRemaining);
    state.timeRemaining = newState.timeRemaining;
  } else if (newState.timeRemaining !== undefined && state.isRunning) {
    console.log('Worker: Timer is running, skipping timeRemaining update to prevent interference');
  }
  
  if (newState.isRunning !== undefined) {
    state.isRunning = newState.isRunning;
  }
  
  if (newState.mode !== undefined) {
    state.mode = newState.mode;
  }
  
  if (newState.currentIteration !== undefined) {
    state.currentIteration = newState.currentIteration;
  }
  
  if (newState.totalIterations !== undefined) {
    state.totalIterations = newState.totalIterations;
  }
  
  if (newState.settings !== undefined) {
    state.settings = {
      ...state.settings,
      ...newState.settings
    };
  }
  
  // Send updated state back to main thread
  self.postMessage({
    type: 'STATE_UPDATED',
    payload: state
  });
}

// Update the timer mode
function updateMode(mode: 'work' | 'break', timeRemaining: number, currentIteration: number, totalIterations: number) {
  console.log('Worker: Updating mode with:', { mode, timeRemaining, currentIteration, totalIterations });
  
  // Update state
  state = {
    ...state,
    mode,
    timeRemaining,
    currentIteration,
    totalIterations,
    isRunning: false
  };
  
  // Clear any existing interval
  if (timerInterval) {
    self.clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Send updated state back to main thread
  self.postMessage({
    type: 'UPDATE_MODE',
    payload: state
  });
  
  console.log('Worker: State updated to:', state);
}

// Update the timer
function updateTime(timeRemaining: number) {
  console.log('Worker: Updating time to:', timeRemaining);
  
  // Don't update if timer is running to prevent interference
  if (state.isRunning) {
    console.log('Worker: Timer is running, skipping time update to prevent interference');
    return;
  }
  
  state.timeRemaining = timeRemaining;
  
  // Send updated state back to main thread (not as TICK to avoid confusion)
  self.postMessage({
    type: 'TIME_UPDATED',
    payload: state
  });
}

// Start the timer
function startTimer() {
  if (!state.isRunning) {
    state.isRunning = true;
    console.log('Worker: Starting timer with timeRemaining:', state.timeRemaining);
    
    // Validate timeRemaining before starting
    if (state.timeRemaining <= 0) {
      console.error('Worker: Cannot start timer with invalid timeRemaining:', state.timeRemaining);
      state.isRunning = false;
      return;
    }
    
    // Use Date.now() for more reliable timing on iOS
    startTime = Date.now();
    targetEndTime = startTime + (state.timeRemaining * 1000);
    console.log('Worker: Timer started at', startTime, 'target end time:', targetEndTime);
    
    timerInterval = self.setInterval(() => {
      if (!state.isRunning || !startTime || !targetEndTime) {
        console.log('Worker: Timer stopped or invalid state, clearing interval');
        if (timerInterval) {
          self.clearInterval(timerInterval);
          timerInterval = null;
        }
        return;
      }
      
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const newTimeRemaining = Math.max(0, state.timeRemaining - elapsedSeconds);
      
      console.log('Worker: Interval tick - now:', now, 'elapsed:', elapsedSeconds, 'new timeRemaining:', newTimeRemaining);
      
      if (newTimeRemaining > 0) {
        // Update timeRemaining and send TICK
        state.timeRemaining = newTimeRemaining;
        console.log('Worker: TICK - timeRemaining:', state.timeRemaining);
        self.postMessage({ 
          type: 'TICK', 
          payload: { 
            timeRemaining: state.timeRemaining,
            mode: state.mode,
            currentIteration: state.currentIteration,
            totalIterations: state.totalIterations,
            isRunning: state.isRunning
          } 
        });
        
        // Update start time for next calculation
        startTime = now;
        targetEndTime = startTime + (state.timeRemaining * 1000);
      } else {
        // Timer has reached zero
        console.log('Worker: Timer reached zero, calling completeTimer()...');
        state.timeRemaining = 0;
        completeTimer();
      }
    }, 1000);
  } else {
    console.log('Worker: Timer is already running');
  }
}

// Pause the timer
function pauseTimer() {
  if (state.isRunning) {
    state.isRunning = false;
    if (timerInterval) {
      self.clearInterval(timerInterval);
      timerInterval = null;
    }
    // Reset timing variables
    startTime = null;
    targetEndTime = null;
    console.log('Worker: Timer paused with timeRemaining:', state.timeRemaining);
    self.postMessage({ 
      type: 'PAUSED', 
      payload: { 
        timeRemaining: state.timeRemaining,
        mode: state.mode,
        currentIteration: state.currentIteration,
        totalIterations: state.totalIterations,
        isRunning: state.isRunning
      } 
    });
  }
}

// Reset the timer
function resetTimer() {
  pauseTimer();
  state.timeRemaining = state.mode === 'work' ? state.settings.workDuration : state.settings.breakDuration;
  self.postMessage({ type: 'RESET', payload: { timeRemaining: state.timeRemaining } });
}

// Complete the timer
function completeTimer() {
  console.log('Worker: completeTimer() called');
  console.log('Worker: Current state before completion:', state);
  
  pauseTimer();
  
  // Play sound if enabled
  if (state.settings.soundEnabled) {
    console.log('Worker: Sending PLAY_SOUND message');
    self.postMessage({ type: 'PLAY_SOUND', payload: { 
      numberOfBeeps: state.settings.numberOfBeeps,
      volume: state.settings.volume,
      soundType: state.settings.soundType
    }});
  }

  // Show notification if enabled
  if (state.settings.browserNotificationsEnabled) {
    console.log('Worker: Sending SHOW_NOTIFICATION message');
    self.postMessage({ type: 'SHOW_NOTIFICATION', payload: { 
      title: state.mode === 'work' ? 'Work Time Complete!' : 'Break Time Complete!',
      body: state.mode === 'work' ? 'Time for a break!' : 'Time to get back to work!'
    }});
  }

  // Switch modes
  const newMode = state.mode === 'work' ? 'break' : 'work';
  
  // Only increment iteration count after break session completes
  if (state.mode === 'break') {
    state.currentIteration++;
  }
  
  state.mode = newMode;
  state.timeRemaining = state.mode === 'work' ? state.settings.workDuration : state.settings.breakDuration;

  // Check if all iterations are complete
  if (state.currentIteration > state.totalIterations) {
    console.log('Worker: All iterations complete, sending COMPLETE message');
    self.postMessage({ type: 'COMPLETE', payload: { 
      mode: state.mode,
      currentIteration: state.currentIteration,
      totalIterations: state.totalIterations
    }});
    return;
  }

  // Send COMPLETE message without starting the next timer
  console.log('Worker: Timer session complete, sending COMPLETE message');
  self.postMessage({ type: 'COMPLETE', payload: { 
    mode: state.mode,
    currentIteration: state.currentIteration,
    totalIterations: state.totalIterations
  }});
  
  console.log('Worker: completeTimer() finished, final state:', state);
}

// Update settings
function updateSettings(settings: Partial<TimerState['settings']>) {
  state.settings = { ...state.settings, ...settings };
  self.postMessage({ type: 'SETTINGS_UPDATED', payload: state.settings });
} 