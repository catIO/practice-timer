// iOS Background Timer Implementation
// This module provides reliable background timer functionality specifically for iOS devices

export interface iOSBackgroundTimerState {
  isRunning: boolean;
  startTime: number | null;
  duration: number;
  timeRemaining: number;
  mode: 'work' | 'break';
  currentIteration: number;
  totalIterations: number;
  lastUpdateTime: number;
  lastSyncTime: number;
  driftCorrection: number;
}

export interface iOSBackgroundTimerCallbacks {
  onTick?: (timeRemaining: number) => void;
  onComplete?: (state: iOSBackgroundTimerState) => void;
  onPause?: () => void;
  onResume?: () => void;
  onBackground?: () => void;
  onForeground?: () => void;
}

class iOSBackgroundTimer {
  private state: iOSBackgroundTimerState;
  private callbacks: iOSBackgroundTimerCallbacks;
  private intervalId: number | null = null;
  private backgroundIntervalId: number | null = null;
  private isActive = false;
  private isBackgrounded = false;
  private audioContext: AudioContext | null = null;
  private silentOscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  constructor(initialState: Partial<iOSBackgroundTimerState>, callbacks: iOSBackgroundTimerCallbacks = {}) {
    this.state = {
      isRunning: false,
      startTime: null,
      duration: 0,
      timeRemaining: 0,
      mode: 'work',
      currentIteration: 1,
      totalIterations: 4,
      lastUpdateTime: Date.now(),
      lastSyncTime: Date.now(),
      driftCorrection: 0,
      ...initialState
    };
    this.callbacks = callbacks;
    this.initializeAudioContext();
    this.setupVisibilityListeners();
  }

  // Initialize audio context for background operation
  private initializeAudioContext(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        
        // Create silent oscillator to keep audio context alive
        this.silentOscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        
        this.silentOscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        
        // Set volume to 0 (completely silent)
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        console.log('Audio context initialized for background operation');
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  // Setup visibility change listeners
  private setupVisibilityListeners(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleBackground();
      } else {
        this.handleForeground();
      }
    });

    // Listen for page focus/blur events
    window.addEventListener('blur', () => this.handleBackground());
    window.addEventListener('focus', () => this.handleForeground());

    // Listen for beforeunload to save state
    window.addEventListener('beforeunload', () => {
      this.persistState();
    });
  }

  // Handle app going to background
  private handleBackground(): void {
    if (this.isBackgrounded) return;
    
    this.isBackgrounded = true;
    console.log('App going to background, switching to background mode');
    
    // Start background interval for more frequent updates
    this.startBackgroundInterval();
    
    // Keep audio context alive
    this.keepAudioContextAlive();
    
    this.callbacks.onBackground?.();
  }

  // Handle app coming to foreground
  private handleForeground(): void {
    if (!this.isBackgrounded) return;
    
    this.isBackgrounded = false;
    console.log('App coming to foreground, syncing timer state');
    
    // Stop background interval
    this.stopBackgroundInterval();
    
    // Sync timer state with actual elapsed time
    this.syncWithRealTime();
    
    this.callbacks.onForeground?.();
  }

  // Keep audio context alive for background operation
  private keepAudioContextAlive(): void {
    if (!this.audioContext || !this.silentOscillator || !this.gainNode) return;

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Start silent oscillator (OscillatorNode doesn't have a state property, so we just start it)
      // The stop() call will handle cleanup, and start() is safe to call multiple times
      this.silentOscillator.start();
      this.silentOscillator.stop(this.audioContext.currentTime + 0.1);

      // Don't schedule periodic silent sounds - they drain battery
      // The initial oscillator and context resume is sufficient
      // Periodic sounds every 30 seconds are unnecessary and waste energy
    } catch (error) {
      console.error('Error keeping audio context alive:', error);
    }
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
      lastUpdateTime: Date.now(),
      lastSyncTime: Date.now(),
      driftCorrection: 0
    };

    this.isActive = true;
    this.startInterval();
    
    // Store state in localStorage for persistence
    this.persistState();
    
    console.log('iOS Background timer started:', this.state);
  }

  // Pause the background timer
  pause(): void {
    this.state.isRunning = false;
    this.isActive = false;
    
    this.stopInterval();
    this.stopBackgroundInterval();
    
    this.persistState();
    this.callbacks.onPause?.();
    
    console.log('iOS Background timer paused:', this.state);
  }

  // Resume the background timer
  resume(): void {
    if (!this.state.startTime) return;
    
    this.state.isRunning = true;
    this.isActive = true;
    this.startInterval();
    
    this.persistState();
    this.callbacks.onResume?.();
    
    console.log('iOS Background timer resumed:', this.state);
  }

  // Stop the background timer
  stop(): void {
    this.state.isRunning = false;
    this.isActive = false;
    
    this.stopInterval();
    this.stopBackgroundInterval();
    
    this.clearPersistedState();
    
    console.log('iOS Background timer stopped');
  }

  // Update timer state
  update(newState: Partial<iOSBackgroundTimerState>): void {
    this.state = { ...this.state, ...newState };
    this.persistState();
  }

  // Get current state
  getState(): iOSBackgroundTimerState {
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
  syncWithRealTime(): void {
    if (this.state.isRunning && this.state.startTime) {
      const actualTimeRemaining = this.calculateTimeRemaining();
      const previousTimeRemaining = this.state.timeRemaining;
      
      // Calculate drift correction
      const drift = actualTimeRemaining - previousTimeRemaining;
      this.state.driftCorrection += drift;
      
      this.state.timeRemaining = actualTimeRemaining;
      this.state.lastUpdateTime = Date.now();
      this.state.lastSyncTime = Date.now();
      
      console.log('Timer synced with real time:', {
        actualTimeRemaining,
        previousTimeRemaining,
        drift,
        totalDriftCorrection: this.state.driftCorrection
      });
      
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
    this.stopInterval();

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

  // Start background interval for more frequent updates when app is backgrounded
  private startBackgroundInterval(): void {
    this.stopBackgroundInterval();

    // Use more frequent updates when backgrounded (every 1 second instead of 1 second)
    this.backgroundIntervalId = window.setInterval(() => {
      if (!this.isActive || !this.state.isRunning) return;

      // Use timestamp-based calculation for more accuracy in background
      const now = Date.now();
      const elapsed = Math.floor((now - this.state.startTime!) / 1000);
      const newTimeRemaining = Math.max(0, this.state.duration - elapsed);
      
      // Apply drift correction
      const correctedTimeRemaining = Math.max(0, newTimeRemaining - this.state.driftCorrection);
      
      this.state.timeRemaining = correctedTimeRemaining;
      this.state.lastUpdateTime = now;
      
      // Call onTick callback
      this.callbacks.onTick?.(correctedTimeRemaining);
      
      // Check if timer should be complete
      if (correctedTimeRemaining <= 0) {
        this.complete();
      }
    }, 1000); // Update every second when backgrounded
  }

  // Stop the main interval
  private stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Stop the background interval
  private stopBackgroundInterval(): void {
    if (this.backgroundIntervalId) {
      clearInterval(this.backgroundIntervalId);
      this.backgroundIntervalId = null;
    }
  }

  // Complete the timer
  private complete(): void {
    this.state.isRunning = false;
    this.state.timeRemaining = 0;
    
    this.stopInterval();
    this.stopBackgroundInterval();
    
    this.persistState();
    this.callbacks.onComplete?.(this.state);
    
    console.log('iOS Background timer completed:', this.state);
  }

  // Persist state to localStorage with timestamp
  private persistState(): void {
    try {
      const stateToPersist = {
        ...this.state,
        persistedAt: Date.now()
      };
      localStorage.setItem('iOSBackgroundTimerState', JSON.stringify(stateToPersist));
    } catch (error) {
      console.error('Failed to persist iOS background timer state:', error);
    }
  }

  // Load state from localStorage
  loadPersistedState(): boolean {
    try {
      const persisted = localStorage.getItem('iOSBackgroundTimerState');
      if (persisted) {
        const parsedState = JSON.parse(persisted);
        delete parsedState.persistedAt; // Remove timestamp
        this.state = { ...this.state, ...parsedState };
        
        // Sync with real time if timer was running
        if (this.state.isRunning) {
          this.syncWithRealTime();
        }
        
        return true;
      }
    } catch (error) {
      console.error('Failed to load persisted iOS background timer state:', error);
    }
    return false;
  }

  // Clear persisted state
  private clearPersistedState(): void {
    try {
      localStorage.removeItem('iOSBackgroundTimerState');
    } catch (error) {
      console.error('Failed to clear persisted iOS background timer state:', error);
    }
  }

  // Cleanup resources
  cleanup(): void {
    this.stop();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.silentOscillator = null;
    this.gainNode = null;
  }
}

// Global iOS background timer instance
let globalIOSBackgroundTimer: iOSBackgroundTimer | null = null;

// Initialize global iOS background timer
export function initializeIOSBackgroundTimer(callbacks: iOSBackgroundTimerCallbacks = {}): iOSBackgroundTimer {
  if (!globalIOSBackgroundTimer) {
    globalIOSBackgroundTimer = new iOSBackgroundTimer({}, callbacks);
    
    // Load any persisted state
    globalIOSBackgroundTimer.loadPersistedState();
  }
  
  return globalIOSBackgroundTimer;
}

// Get global iOS background timer instance
export function getIOSBackgroundTimer(): iOSBackgroundTimer | null {
  return globalIOSBackgroundTimer;
}

// Cleanup global iOS background timer
export function cleanupIOSBackgroundTimer(): void {
  if (globalIOSBackgroundTimer) {
    globalIOSBackgroundTimer.cleanup();
    globalIOSBackgroundTimer = null;
  }
}

export default iOSBackgroundTimer;
