// Wake Lock Fallback wrapper - uses unified wakeLockManager

import { wakeLockManager } from './wakeLockManager';

export class WakeLockFallback {
  async request(): Promise<boolean> {
    return wakeLockManager.acquire();
  }

  async release(): Promise<void> {
    return wakeLockManager.release();
  }

  get isWakeLockActive(): boolean {
    return wakeLockManager.isActive;
  }
}

let globalWakeLockFallback: WakeLockFallback | null = null;

export function getWakeLockFallback(): WakeLockFallback {
  if (!globalWakeLockFallback) {
    globalWakeLockFallback = new WakeLockFallback();
  }
  return globalWakeLockFallback;
}

export function cleanupWakeLockFallback(): void {
  if (globalWakeLockFallback) {
    globalWakeLockFallback.release();
    globalWakeLockFallback = null;
  }
}
