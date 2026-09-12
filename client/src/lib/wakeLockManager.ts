// Unified Wake Lock Manager
// Uses native W3C Screen Wake Lock API across modern browsers (Chrome, Safari 16.4+, Edge, Firefox 126+)

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

class WakeLockManager {
  private nativeSentinel: WakeLockSentinelLike | null = null;
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

  private attachVisibilityListeners(): void {
    if (this.listenersAttached || typeof document === 'undefined') return;
    this.listenersAttached = true;

    const handleVisibilityOrFocus = async () => {
      if (this.isRequested && document.visibilityState === 'visible' && !this.nativeSentinel) {
        // Page returned to foreground; re-acquire wake lock if released while backgrounded
        await this.acquireInternal();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);
  }

  private async acquireInternal(): Promise<boolean> {
    if (!this.isRequested) return false;

    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        this.nativeSentinel = sentinel;

        sentinel.addEventListener?.('release', () => {
          this.nativeSentinel = null;
          if (this.isRequested) {
            // Safari/WebKit revoked the lock (e.g. multitasking, slide over, lock screen)
            // Re-acquire native lock
            this.acquireInternal().catch(() => {});
          } else {
            this.updateStatusAttribute(false);
          }
        });

        this.updateStatusAttribute(true);
        return true;
      } catch (error) {
        // Native wake lock can fail in low power mode or non-secure contexts
        console.warn('[WakeLock] Native wakeLock request failed:', error);
      }
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
      } catch {
        // Ignore release errors
      }
      this.nativeSentinel = null;
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
