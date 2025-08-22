// Background Timer Utility for iOS
// This module provides background timer functionality that works around iOS limitations

export interface BackgroundTimerState {
  isRunning: boolean;
  startTime: number | null;
  duration: number;
  timeRemaining: number;
  mode: 'work' | 'break';
  currentIteration: number;
  totalIterations: number;
  lastUpdateTime: number;
}

export interface BackgroundTimerCallbacks {
  onTick?: (timeRemaining: number) => void;
  onComplete?: (state: BackgroundTimerState) => void;
  onPause?: () => void;
  onResume?: () => void;
}

class BackgroundTimer {
  private state: BackgroundTimerState;
  private callbacks: BackgroundTimerCallbacks;
  private intervalId: number | null = null;
  private isActive = false;

  constructor(initialState: Partial<BackgroundTimerState>, callbacks: BackgroundTimerCallbacks = {}) {
    this.state = {
      isRunning: false,
      startTime: null,
      duration: 0,
      timeRemaining: 0,
      mode: 'work',
      currentIteration: 1,
      totalIterations: 4,
      lastUpdateTime: Date.now(),
      ...initialState
    };
    this.callbacks = callbacks;
  }

  // Start the background timer
  start(duration: number, mode: 'work' | 'break', currentIteration: number, totalIterations: number): void {
    this.state = {
      ...this.state,
      isRunning: true,
      startTime: Date.now(),
      duration,
      timeRemaining: duration,
      mode,
      currentIteration,
      totalIterations,
      lastUpdateTime: Date.now()
    };

    this.isActive = true;
    this.startInterval();
    
    // Store state in localStorage for persistence
    this.persistState();
    
    console.log('Background timer started:', this.state);
  }

  // Pause the background timer
  pause(): void {
    this.state.isRunning = false;
    this.isActive = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.persistState();
    this.callbacks.onPause?.();
    
    console.log('Background timer paused:', this.state);
  }

  // Resume the background timer
  resume(): void {
    if (!this.state.startTime) return;
    
    this.state.isRunning = true;
    this.isActive = true;
    this.startInterval();
    
    this.persistState();
    this.callbacks.onResume?.();
    
    console.log('Background timer resumed:', this.state);
  }

  // Stop the background timer
  stop(): void {
    this.state.isRunning = false;
    this.isActive = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.clearPersistedState();
    
    console.log('Background timer stopped');
  }

  // Update timer state
  update(newState: Partial<BackgroundTimerState>): void {
    this.state = { ...this.state, ...newState };
    this.persistState();
  }

  // Get current state
  getState(): BackgroundTimerState {
    return { ...this.state };
  }

  // Calculate accurate time remaining based on start time
  calculateTimeRemaining(): number {
    if (!this.state.startTime || !this.state.isRunning) {
      return this.state.timeRemaining;
    }

    const now = Date.now();
    const elapsed = Math.floor((now - this.state.startTime) / 1000);
    const remaining = Math.max(0, this.state.duration - elapsed);
    
    return remaining;
  }

  // Sync with actual elapsed time (called when app becomes active)
  sync(): void {
    if (this.state.isRunning && this.state.startTime) {
      const actualTimeRemaining = this.calculateTimeRemaining();
      this.state.timeRemaining = actualTimeRemaining;
      this.state.lastUpdateTime = Date.now();
      
      // Check if timer should be complete
      if (actualTimeRemaining <= 0) {
        this.complete();
      } else {
        this.persistState();
      }
    }
  }

  // Start the interval for timer updates
  private startInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = window.setInterval(() => {
      if (!this.isActive || !this.state.isRunning) return;

      const now = Date.now();
      const elapsed = Math.floor((now - this.state.startTime!) / 1000);
      const newTimeRemaining = Math.max(0, this.state.duration - elapsed);
      
      this.state.timeRemaining = newTimeRemaining;
      this.state.lastUpdateTime = now;
      
      // Call tick callback
      this.callbacks.onTick?.(newTimeRemaining);
      
      // Check if timer is complete
      if (newTimeRemaining <= 0) {
        this.complete();
      } else {
        this.persistState();
      }
    }, 1000);
  }

  // Complete the timer
  private complete(): void {
    this.state.isRunning = false;
    this.state.timeRemaining = 0;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.persistState();
    this.callbacks.onComplete?.(this.state);
    
    console.log('Background timer completed:', this.state);
  }

  // Persist state to localStorage
  private persistState(): void {
    try {
      localStorage.setItem('backgroundTimerState', JSON.stringify(this.state));
    } catch (error) {
      console.error('Failed to persist background timer state:', error);
    }
  }

  // Load state from localStorage
  loadPersistedState(): boolean {
    try {
      const persisted = localStorage.getItem('backgroundTimerState');
      if (persisted) {
        const parsedState = JSON.parse(persisted);
        this.state = { ...this.state, ...parsedState };
        return true;
      }
    } catch (error) {
      console.error('Failed to load persisted background timer state:', error);
    }
    return false;
  }

  // Clear persisted state
  private clearPersistedState(): void {
    try {
      localStorage.removeItem('backgroundTimerState');
    } catch (error) {
      console.error('Failed to clear persisted background timer state:', error);
    }
  }
}

// Global background timer instance
let globalBackgroundTimer: BackgroundTimer | null = null;

// Initialize global background timer
export function initializeBackgroundTimer(callbacks: BackgroundTimerCallbacks = {}): BackgroundTimer {
  if (!globalBackgroundTimer) {
    globalBackgroundTimer = new BackgroundTimer({}, callbacks);
    
    // Load any persisted state
    globalBackgroundTimer.loadPersistedState();
    
    // Sync with actual time when app becomes active
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && globalBackgroundTimer) {
        globalBackgroundTimer.sync();
      }
    });
    
    // Sync when window gains focus
    window.addEventListener('focus', () => {
      if (globalBackgroundTimer) {
        globalBackgroundTimer.sync();
      }
    });
  }
  
  return globalBackgroundTimer;
}

// Get global background timer instance
export function getBackgroundTimer(): BackgroundTimer | null {
  return globalBackgroundTimer;
}

// Cleanup global background timer
export function cleanupBackgroundTimer(): void {
  if (globalBackgroundTimer) {
    globalBackgroundTimer.stop();
    globalBackgroundTimer = null;
  }
}

export default BackgroundTimer;
