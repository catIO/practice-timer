// iOS Wake Lock Implementation
// This module provides reliable wake lock functionality specifically for iOS devices

export interface iOSWakeLockOptions {
  preventScreenTimeout?: boolean;
  preventSystemSleep?: boolean;
  audioContext?: boolean;
  userActivity?: boolean;
  fullscreen?: boolean;
}

export class iOSWakeLock {
  private isActive = false;
  private options: iOSWakeLockOptions;
  private audioContext: AudioContext | null = null;
  private silentOscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private userActivityInterval: number | null = null;
  private audioKeepAliveInterval: number | null = null;
  private fullscreenElement: Element | null = null;

  constructor(options: iOSWakeLockOptions = {}) {
    this.options = {
      preventScreenTimeout: true,
      preventSystemSleep: true,
      audioContext: true,
      userActivity: true,
      fullscreen: false,
      ...options
    };
  }

  // Request wake lock using multiple iOS-compatible strategies
  async request(): Promise<boolean> {
    if (this.isActive) {
      return true;
    }

    try {
      console.log('Requesting iOS wake lock with options:', this.options);

      // Strategy 1: Try native wake lock API (limited support on iOS)
      if (this.options.preventScreenTimeout && 'wakeLock' in navigator) {
        try {
          const wakeLockType = 'system' in (navigator as any).wakeLock ? 'system' : 'screen';
          const wakeLock = await (navigator as any).wakeLock.request(wakeLockType);
          
          wakeLock.addEventListener('release', () => {
            console.log('Native wake lock was released');
            this.isActive = false;
          });
          
          this.isActive = true;
          console.log('Native wake lock acquired successfully');
          return true;
        } catch (error) {
          console.log('Native wake lock failed, trying fallback strategies:', error);
        }
      }

      // Strategy 2: Audio context (most reliable on iOS)
      if (this.options.audioContext) {
        await this.initializeAudioContext();
      }

      // Strategy 3: User activity simulation
      if (this.options.userActivity) {
        this.startUserActivitySimulation();
      }

      // Strategy 4: Fullscreen mode (if requested)
      if (this.options.fullscreen) {
        await this.requestFullscreen();
      }

      this.isActive = true;
      // Add data attribute to track wake lock status
      document.documentElement.setAttribute('data-wake-lock', 'active');
      console.log('iOS wake lock activated using fallback strategies');
      return true;

    } catch (error) {
      console.error('Failed to request iOS wake lock:', error);
      return false;
    }
  }

  // Initialize audio context for wake lock
  private async initializeAudioContext(): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        
        // Create silent oscillator
        this.silentOscillator = this.audioContext.createOscillator();
        this.gainNode = this.audioContext.createGain();
        
        this.silentOscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        
        // Set volume to 0 (completely silent)
        this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        // Start silent oscillator
        this.silentOscillator.start();
        this.silentOscillator.stop(this.audioContext.currentTime + 0.1);
        
        // Schedule periodic silent sounds to keep context alive
        this.audioKeepAliveInterval = window.setInterval(() => {
          if (this.audioContext && this.audioContext.state === 'running') {
            const oscillator = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            oscillator.connect(gain);
            gain.connect(this.audioContext.destination);
            gain.gain.setValueAtTime(0, this.audioContext.currentTime);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.01);
          }
        }, 30000); // Every 30 seconds
        
        console.log('Audio context initialized for wake lock');
      }
    } catch (error) {
      console.error('Failed to initialize audio context for wake lock:', error);
    }
  }

  // Start user activity simulation
  private startUserActivitySimulation(): void {
    if (this.userActivityInterval) {
      clearInterval(this.userActivityInterval);
    }

    this.userActivityInterval = window.setInterval(() => {
      // Simulate mouse movement
      const mouseEvent = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: Math.random() * 10,
        clientY: Math.random() * 10
      });
      
      document.dispatchEvent(mouseEvent);
      
      // Simulate touch event for mobile devices
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
      
      // Simulate keyboard event
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        keyCode: 9,
        which: 9,
        bubbles: true,
        cancelable: true
      });
      
      document.dispatchEvent(keyEvent);
      
    }, 15000); // Every 15 seconds
  }

  // Request fullscreen mode
  private async requestFullscreen(): Promise<void> {
    try {
      if (document.documentElement.requestFullscreen) {
        this.fullscreenElement = await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        this.fullscreenElement = await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).mozRequestFullScreen) {
        this.fullscreenElement = await (document.documentElement as any).mozRequestFullScreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        this.fullscreenElement = await (document.documentElement as any).msRequestFullscreen();
      }
      
      console.log('Fullscreen mode activated for wake lock');
    } catch (error) {
      console.error('Failed to request fullscreen mode:', error);
    }
  }

  // Release wake lock
  async release(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    console.log('Releasing iOS wake lock');

    // Stop user activity simulation
    if (this.userActivityInterval) {
      clearInterval(this.userActivityInterval);
      this.userActivityInterval = null;
    }

    // Stop audio keep-alive
    if (this.audioKeepAliveInterval) {
      clearInterval(this.audioKeepAliveInterval);
      this.audioKeepAliveInterval = null;
    }

    // Close audio context
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.error('Error closing audio context:', error);
      }
      this.audioContext = null;
    }

    this.silentOscillator = null;
    this.gainNode = null;

    // Exit fullscreen mode
    if (this.fullscreenElement && document.fullscreenElement) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
      } catch (error) {
        console.error('Error exiting fullscreen mode:', error);
      }
      this.fullscreenElement = null;
    }

    // Remove data attribute
    document.documentElement.removeAttribute('data-wake-lock');
    this.isActive = false;
    console.log('iOS wake lock released');
  }

  // Check if wake lock is active
  get isWakeLockActive(): boolean {
    return this.isActive;
  }

  // Get current audio context state
  get audioContextState(): string | null {
    return this.audioContext?.state || null;
  }

  // Resume audio context if suspended
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('Audio context resumed');
      } catch (error) {
        console.error('Failed to resume audio context:', error);
      }
    }
  }
}

// Global iOS wake lock instance
let globalIOSWakeLock: iOSWakeLock | null = null;

// Get or create global iOS wake lock instance
export function getIOSWakeLock(options?: iOSWakeLockOptions): iOSWakeLock {
  if (!globalIOSWakeLock) {
    globalIOSWakeLock = new iOSWakeLock(options);
  }
  return globalIOSWakeLock;
}

// Cleanup global iOS wake lock instance
export function cleanupIOSWakeLock(): void {
  if (globalIOSWakeLock) {
    globalIOSWakeLock.release();
    globalIOSWakeLock = null;
  }
}

export default iOSWakeLock;
