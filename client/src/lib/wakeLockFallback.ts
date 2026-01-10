// Wake Lock Fallback for browsers that don't support the Wake Lock API
// This provides alternative methods to prevent screen timeout

export class WakeLockFallback {
  private intervalId: number | null = null;
  private isActive = false;
  private silentOscillator: OscillatorNode | null = null;

  constructor() {
    this.isActive = false;
  }

  // Request wake lock using fallback methods
  async request(): Promise<boolean> {
    if ('wakeLock' in navigator) {
      // Use native wake lock if available
      try {
        const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
        const wakeLock = await (navigator as any).wakeLock.request(wakeLockType);
        
        wakeLock.addEventListener('release', () => {
          console.log('Native wake lock was released');
          this.isActive = false;
        });
        
        this.isActive = true;
        return true;
      } catch (error) {
        console.error('Native wake lock failed, using fallback:', error);
      }
    }

    // Fallback: Use periodic user activity simulation
    return this.startFallback();
  }

  // Start fallback wake lock mechanism
  private startFallback(): boolean {
    if (this.isActive) {
      return true;
    }

    try {
      // Only use minimal audio context approach - no user activity simulation
      // User activity simulation drains battery significantly
      this.keepAudioContextAlive();

      this.isActive = true;
      // Add data attribute to track wake lock status
      document.documentElement.setAttribute('data-wake-lock', 'active');
      console.log('Fallback wake lock started (minimal mode)');
      return true;
    } catch (error) {
      console.error('Failed to start fallback wake lock:', error);
      return false;
    }
  }

  // Keep audio context alive to prevent screen timeout (minimal approach)
  private keepAudioContextAlive(): void {
    try {
      // Only create audio context if native wake lock is not available
      // This is a minimal approach that doesn't drain battery
      if (!window.audioContext) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          window.audioContext = new AudioContext();
        }
      }
      
      // Create or recreate silent oscillator if needed
      if (window.audioContext && !this.silentOscillator) {
        // Create a silent oscillator to keep the context alive
        // This helps with iOS background support without draining battery
        const oscillator = window.audioContext.createOscillator();
        const gainNode = window.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(window.audioContext.destination);
        
        // Set volume to 0 (silent)
        gainNode.gain.setValueAtTime(0, window.audioContext.currentTime);
        
        // Start a very long-running silent oscillator (hours) to keep context alive
        // This is more efficient than periodic sounds
        oscillator.start();
        // Store reference so we can stop it when releasing
        this.silentOscillator = oscillator;
        // Don't stop it - let it run to keep the context alive
        // It's silent so it won't drain battery
      }
      
      // Resume if suspended to ensure context stays active
      if (window.audioContext && window.audioContext.state === 'suspended') {
        window.audioContext.resume().catch(() => {
          // Ignore errors - audio context may not be needed
        });
      }
    } catch (error) {
      // Silently fail - audio context is optional
    }
  }

  // Additional method: Use fullscreen API if available
  private requestFullscreen(): void {
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).mozRequestFullScreen) {
        (document.documentElement as any).mozRequestFullScreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        (document.documentElement as any).msRequestFullscreen();
      }
    } catch (error) {
      console.log('Fullscreen not available:', error);
    }
  }

  // Release wake lock
  async release(): Promise<void> {
    this.isActive = false;

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Stop silent oscillator if running
    if (this.silentOscillator) {
      try {
        // Stop the oscillator at the current time
        if (window.audioContext && window.audioContext.state !== 'closed') {
          this.silentOscillator.stop(window.audioContext.currentTime);
        } else {
          this.silentOscillator.stop();
        }
      } catch (error) {
        // Ignore errors - oscillator may have already stopped
      }
      this.silentOscillator = null;
    }

    // Release audio context if we created one
    try {
      if (window.audioContext && window.audioContext.state !== 'closed') {
        await window.audioContext.close();
        window.audioContext = undefined;
      }
    } catch (error) {
      // Silently fail - audio context cleanup is optional
    }

    // Remove data attribute
    document.documentElement.removeAttribute('data-wake-lock');
  }

  // Check if wake lock is active
  get isWakeLockActive(): boolean {
    return this.isActive;
  }
}

// Global instance
let globalWakeLockFallback: WakeLockFallback | null = null;

// Get or create global instance
export function getWakeLockFallback(): WakeLockFallback {
  if (!globalWakeLockFallback) {
    globalWakeLockFallback = new WakeLockFallback();
  }
  return globalWakeLockFallback;
}

// Cleanup global instance
export function cleanupWakeLockFallback(): void {
  if (globalWakeLockFallback) {
    globalWakeLockFallback.release();
    globalWakeLockFallback = null;
  }
}

// Extend Window interface for audio context
declare global {
  interface Window {
    audioContext?: AudioContext;
  }
}
