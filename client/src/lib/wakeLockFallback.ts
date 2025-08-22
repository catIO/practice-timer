// Wake Lock Fallback for browsers that don't support the Wake Lock API
// This provides alternative methods to prevent screen timeout

export class WakeLockFallback {
  private intervalId: number | null = null;
  private isActive = false;

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
      // Method 1: Simulate user activity periodically (more frequent for better prevention)
      this.intervalId = window.setInterval(() => {
        // Simulate a small mouse movement or touch event
        const event = new MouseEvent('mousemove', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: Math.random() * 10,
          clientY: Math.random() * 10
        });
        
        document.dispatchEvent(event);
        
        // Also simulate a touch event for mobile devices
        const touchEvent = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [new Touch({
            identifier: 0,
            target: document.body,
            clientX: Math.random() * 10,
            clientY: Math.random() * 10,
            pageX: Math.random() * 10,
            pageY: Math.random() * 10,
            radiusX: 1,
            radiusY: 1,
            rotationAngle: 0,
            force: 1
          })]
        });
        
        document.dispatchEvent(touchEvent);
      }, 15000); // Every 15 seconds for better prevention

      // Method 2: Keep audio context alive (if available)
      this.keepAudioContextAlive();

      // Method 3: Use requestAnimationFrame to keep the page active
      this.keepPageActive();

      this.isActive = true;
      console.log('Fallback wake lock started');
      return true;
    } catch (error) {
      console.error('Failed to start fallback wake lock:', error);
      return false;
    }
  }

  // Keep audio context alive to prevent screen timeout
  private keepAudioContextAlive(): void {
    try {
      // Create a silent audio context if one doesn't exist
      if (!window.audioContext) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          window.audioContext = new AudioContext();
          
          // Create a silent oscillator to keep the context alive
          const oscillator = window.audioContext.createOscillator();
          const gainNode = window.audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(window.audioContext.destination);
          
          // Set volume to 0 (silent)
          gainNode.gain.setValueAtTime(0, window.audioContext.currentTime);
          
          oscillator.start();
          oscillator.stop(window.audioContext.currentTime + 0.1);
        }
      }
      
      // Also try to keep the audio context active with periodic silent sounds
      if (window.audioContext && window.audioContext.state === 'suspended') {
        window.audioContext.resume();
      }
    } catch (error) {
      console.log('Audio context fallback not available:', error);
    }
  }

  // Use requestAnimationFrame to keep the page active
  private keepPageActive(): void {
    const keepAlive = () => {
      if (this.isActive) {
        requestAnimationFrame(keepAlive);
      }
    };
    
    requestAnimationFrame(keepAlive);
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

    // Release audio context if we created one
    try {
      if (window.audioContext && window.audioContext.state !== 'closed') {
        await window.audioContext.close();
        window.audioContext = null;
      }
    } catch (error) {
      console.log('Error closing audio context:', error);
    }

    console.log('Fallback wake lock released');
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
