// Timer Web Worker
import { TimerState } from '../lib/timerWorkerSingleton';

let workerId: string | null = null;
let timerInterval: number | null = null;

// Worker state
// NOTE: Settings durations are stored in MINUTES, not seconds
// When using durations, always multiply by 60 to convert to seconds
let state: TimerState = {
  timeRemaining: 0,
  isRunning: false,
  mode: 'work',
  currentIteration: 1,
  totalIterations: 4,
  settings: {
    workDuration: 25, // Minutes (will be converted to seconds when used)
    breakDuration: 5, // Minutes (will be converted to seconds when used)
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

// Sequence counter for outgoing messages
let messageSequence = 0;

function updateTimer() {
  if (state.timeRemaining > 0) {
    state.timeRemaining--;
    messageSequence++;
    self.postMessage({ 
      type: 'TICK', 
      payload: state,
      sequence: messageSequence
    });
  } else {
    state.isRunning = false;
    if (timerInterval) {
      self.clearInterval(timerInterval);
      timerInterval = null;
    }
    messageSequence++;
    self.postMessage({ 
      type: 'COMPLETE',
      payload: state,
      sequence: messageSequence
    });
  }
}

// Message sequence tracking
let lastReceivedSequence = 0;

// Handle messages from the main thread
self.addEventListener('message', (event: MessageEvent) => {
  const { type, payload, sequence } = event.data;
  
  // Validate sequence number (ignore stale/duplicate messages)
  if (sequence !== undefined) {
    if (sequence <= lastReceivedSequence) {
      // Stale message, ignore but acknowledge
      self.postMessage({ 
        type: 'ACK', 
        sequence,
        payload: { ignored: true, reason: 'stale' }
      });
      return;
    }
    lastReceivedSequence = sequence;
  }

  switch (type) {
    case 'INIT':
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
      // Update state from payload before starting
      if (payload) {
        if (payload.timeRemaining !== undefined) {
          state.timeRemaining = payload.timeRemaining;
        }
        if (payload.mode) {
          state.mode = payload.mode;
        }
        if (payload.currentIteration !== undefined) {
          state.currentIteration = payload.currentIteration;
        }
        if (payload.totalIterations !== undefined) {
          state.totalIterations = payload.totalIterations;
        }
      }
      startTimer();
      break;

    case 'PAUSE':
      pauseTimer();
      break;

    case 'RESET':
      resetTimer();
      break;

    case 'UPDATE_STATE':
      updateState(payload);
      break;

    case 'UPDATE_SETTINGS':
      updateSettings(payload);
      break;

    case 'UPDATE_TIME':
      updateTime(payload.timeRemaining);
      break;

    case 'UPDATE_MODE':
      updateMode(payload.mode, payload.timeRemaining, payload.currentIteration, payload.totalIterations);
      break;

    case 'SYNC_STATE':
      // Sync state without interfering with running timer
      if (!state.isRunning) {
        state.timeRemaining = payload.timeRemaining;
        state.mode = payload.mode;
        state.currentIteration = payload.currentIteration;
        state.totalIterations = payload.totalIterations;
        state.isRunning = payload.isRunning;
      }
      break;

    default:
      // Unknown message type - silently ignore
      break;
  }
});

// Update the worker's state
function updateState(newState: Partial<TimerState>) {
  // Don't update timeRemaining if timer is running to prevent interference
  if (newState.timeRemaining !== undefined && !state.isRunning) {
    state.timeRemaining = newState.timeRemaining;
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
  messageSequence++;
  self.postMessage({
    type: 'STATE_UPDATED',
    payload: state,
    sequence: messageSequence
  });
}

// Update the timer mode
function updateMode(mode: 'work' | 'break', timeRemaining: number, currentIteration: number, totalIterations: number) {
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
  messageSequence++;
  self.postMessage({
    type: 'UPDATE_MODE',
    payload: state,
    sequence: messageSequence
  });
}

// Update the timer
function updateTime(timeRemaining: number) {
  // Don't update if timer is running to prevent interference
  if (state.isRunning) {
    return;
  }
  
  state.timeRemaining = timeRemaining;
  
  // Send updated state back to main thread (not as TICK to avoid confusion)
  messageSequence++;
  self.postMessage({
    type: 'TIME_UPDATED',
    payload: state,
    sequence: messageSequence
  });
}

// Start the timer
function startTimer() {
  if (state.isRunning) {
    // Already running, don't start again
    console.log('Worker: Timer already running, ignoring start request');
    return;
  }
  
  // Validate timeRemaining before starting
  if (state.timeRemaining <= 0) {
    console.log('Worker: Cannot start timer - timeRemaining is 0 or negative:', state.timeRemaining);
    return;
  }
  
  console.log('Worker: Starting timer with timeRemaining:', state.timeRemaining, 'mode:', state.mode);
  
  // Clear any existing interval first
  if (timerInterval) {
    console.log('Worker: Clearing existing interval before starting');
    self.clearInterval(timerInterval);
    timerInterval = null;
  }
  
  state.isRunning = true;
  
  // Send initial state update
  messageSequence++;
  self.postMessage({ 
    type: 'TICK', 
    payload: { 
      timeRemaining: state.timeRemaining,
      mode: state.mode,
      currentIteration: state.currentIteration,
      totalIterations: state.totalIterations,
      isRunning: state.isRunning
    },
    sequence: messageSequence
  });
  
  // Start the interval
  timerInterval = self.setInterval(() => {
    if (state.timeRemaining > 0) {
      state.timeRemaining--;
      messageSequence++;
      self.postMessage({ 
        type: 'TICK', 
        payload: { 
          timeRemaining: state.timeRemaining,
          mode: state.mode,
          currentIteration: state.currentIteration,
          totalIterations: state.totalIterations,
          isRunning: state.isRunning
        },
        sequence: messageSequence
      });
    } else {
      completeTimer();
    }
  }, 1000);
  
  console.log('Worker: Timer interval started');
}

// Pause the timer
function pauseTimer() {
  if (state.isRunning) {
    state.isRunning = false;
    if (timerInterval) {
      self.clearInterval(timerInterval);
      timerInterval = null;
    }
    messageSequence++;
    self.postMessage({ 
      type: 'PAUSED', 
      payload: { 
        timeRemaining: state.timeRemaining,
        mode: state.mode,
        currentIteration: state.currentIteration,
        totalIterations: state.totalIterations,
        isRunning: state.isRunning
      },
      sequence: messageSequence
    });
  }
}

// Reset the timer
function resetTimer() {
  pauseTimer();
  // Settings are in minutes, convert to seconds
  state.timeRemaining = state.mode === 'work' 
    ? state.settings.workDuration * 60 
    : state.settings.breakDuration * 60;
  messageSequence++;
  self.postMessage({ 
    type: 'RESET', 
    payload: { timeRemaining: state.timeRemaining },
    sequence: messageSequence
  });
}

// Complete the timer
function completeTimer() {
  console.log('Worker: completeTimer() called');
  console.log('Worker: Current state before completion:', state);
  
  pauseTimer();
  
  // Check if this is the last work session - if so, practice is complete
  // For practice completion, don't play sound here - it will be played in handlePracticeComplete
  const isPracticeComplete = state.mode === 'work' && state.currentIteration === state.totalIterations;
  
  // Play sound if enabled (but not for practice completion - that's handled separately)
  if (state.settings.soundEnabled && !isPracticeComplete) {
    console.log('Worker: Sending PLAY_SOUND message');
    // Ensure volume is in 0-100 range for playSound function
    // Store might have volume in 0-100 range, worker might store as 0-1, normalize to 0-100
    let volume = state.settings.volume;
    if (volume <= 1) {
      // Volume is in 0-1 range, convert to 0-100
      volume = volume * 100;
    }
    // Ensure volume is within valid range
    volume = Math.min(100, Math.max(0, volume));
    self.postMessage({ type: 'PLAY_SOUND', payload: { 
      numberOfBeeps: state.settings.numberOfBeeps,
      volume: volume,
      soundType: state.settings.soundType
    }});
  }

  if (isPracticeComplete) {
    console.log('Worker: Last work session complete, practice is finished!');
    
    // Show notification if enabled
    if (state.settings.browserNotificationsEnabled) {
      console.log('Worker: Sending SHOW_NOTIFICATION message for practice completion');
      self.postMessage({ type: 'SHOW_NOTIFICATION', payload: { 
        title: 'Practice Complete!',
        body: `You've completed all ${state.totalIterations} work sessions!`
      }});
    }
    
    // Send PRACTICE_COMPLETE message
    messageSequence++;
    self.postMessage({ 
      type: 'PRACTICE_COMPLETE', 
      payload: { 
        currentIteration: state.currentIteration,
        totalIterations: state.totalIterations
      },
      sequence: messageSequence
    });
    return;
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
  state.timeRemaining = state.mode === 'work' ? state.settings.workDuration * 60 : state.settings.breakDuration * 60;

  // Check if all iterations are complete (shouldn't happen after last work session check above, but safety check)
  if (state.currentIteration > state.totalIterations) {
    messageSequence++;
    self.postMessage({ 
      type: 'COMPLETE', 
      payload: { 
        mode: state.mode,
        currentIteration: state.currentIteration,
        totalIterations: state.totalIterations,
        timeRemaining: state.timeRemaining
      },
      sequence: messageSequence
    });
    return;
  }

  // Send COMPLETE message with updated state (mode switched, ready for next session)
  messageSequence++;
  self.postMessage({ 
    type: 'COMPLETE', 
    payload: { 
      mode: state.mode,
      currentIteration: state.currentIteration,
      totalIterations: state.totalIterations,
      timeRemaining: state.timeRemaining
    },
    sequence: messageSequence
  });
}

// Update settings
function updateSettings(settings: Partial<TimerState['settings']>) {
  state.settings = { ...state.settings, ...settings };
  messageSequence++;
  self.postMessage({ 
    type: 'SETTINGS_UPDATED', 
    payload: state.settings,
    sequence: messageSequence
  });
} 