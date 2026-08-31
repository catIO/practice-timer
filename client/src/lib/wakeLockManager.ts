// Unified Wake Lock Manager
// Supports W3C Screen Wake Lock API with seamless inline video loop fallback for iOS / iPadOS

// 2x2 blank H.264 MP4 data URI (public domain, battery-efficient fallback)
const BLANK_VIDEO_DATA_URI =
  'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAAAAGlzb21tcDQyAAACAG1vb3YAAAAmbXZoZAAAAADK9/JMyvfyaAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIZdHJhawAAAFx0a2hkAAAAB8r38mrK9/JoAAAAAAABAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAEAAAAAEAAAAAAAAAAAAAAAEAAAEAAAAAAAAAAAAAAA==';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

class WakeLockManager {
  private nativeSentinel: WakeLockSentinelLike | null = null;
  private fallbackVideo: HTMLVideoElement | null = null;
  private isRequested = false;
  private listenersAttached = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.attachVisibilityListeners();
    }
  }

  private updateStatusAttribute(active: boolean): void {
    if (typeof document === 'undefined') return;
    if (active) {
      document.documentElement.setAttribute('data-wake-lock', 'active');
    } else {
      document.documentElement.removeAttribute('data-wake-lock');
    }
  }

  private getOrCreateVideo(): HTMLVideoElement | null {
    if (typeof document === 'undefined') return null;
    if (!this.fallbackVideo) {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('loop', '');
      video.setAttribute('muted', '');
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.style.position = 'fixed';
      video.style.left = '-9999px';
      video.style.top = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.src = BLANK_VIDEO_DATA_URI;
      this.fallbackVideo = video;
    }
    return this.fallbackVideo;
  }

  private attachVisibilityListeners(): void {
    if (this.listenersAttached || typeof document === 'undefined') return;
    this.listenersAttached = true;

    const handleVisibilityOrFocus = async () => {
      if (this.isRequested && document.visibilityState === 'visible') {
        // Page returned to foreground; re-acquire native wake lock if released by Safari
        await this.acquireInternal();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);
  }

  private async acquireInternal(): Promise<boolean> {
    if (!this.isRequested) return false;

    // 1. Try native Screen Wake Lock API (Chrome, Edge, Safari 16.4+, Firefox 126+)
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        this.nativeSentinel = sentinel;
        sentinel.addEventListener('release', () => {
          this.nativeSentinel = null;
          if (!this.isRequested) {
            this.updateStatusAttribute(false);
          }
        });
        this.updateStatusAttribute(true);
        return true;
      } catch (error) {
        // Native wake lock can fail in low power mode or non-secure contexts
        console.warn('[WakeLock] Native wakeLock request failed, trying fallback:', error);
      }
    }

    // 2. Video loop fallback (iOS / iPadOS when native wake lock is rejected or unavailable)
    try {
      const video = this.getOrCreateVideo();
      if (video) {
        if (!document.body.contains(video)) {
          document.body.appendChild(video);
        }
        if (video.paused) {
          await video.play();
        }
        this.updateStatusAttribute(true);
        return true;
      }
    } catch (videoError) {
      console.warn('[WakeLock] Video fallback failed:', videoError);
    }

    return false;
  }

  public async acquire(): Promise<boolean> {
    this.isRequested = true;
    return this.acquireInternal();
  }

  public async release(): Promise<void> {
    this.isRequested = false;

    if (this.nativeSentinel) {
      try {
        await this.nativeSentinel.release();
      } catch (err) {
        // Ignore release errors
      }
      this.nativeSentinel = null;
    }

    if (this.fallbackVideo) {
      try {
        this.fallbackVideo.pause();
        if (this.fallbackVideo.parentNode) {
          this.fallbackVideo.parentNode.removeChild(this.fallbackVideo);
        }
      } catch (err) {
        // Ignore video pause errors
      }
      this.fallbackVideo = null;
    }

    this.updateStatusAttribute(false);
  }

  public get isActive(): boolean {
    return this.isRequested;
  }
}

export const wakeLockManager = new WakeLockManager();

export async function requestWakeLock(): Promise<boolean> {
  return wakeLockManager.acquire();
}

export async function releaseWakeLock(): Promise<void> {
  return wakeLockManager.release();
}

export function isWakeLockActive(): boolean {
  return wakeLockManager.isActive;
}
