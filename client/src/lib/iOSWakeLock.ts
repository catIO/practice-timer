// iOS Wake Lock Implementation - bridged to unified wakeLockManager

import { wakeLockManager } from './wakeLockManager';

export interface iOSWakeLockOptions {
  preventScreenTimeout?: boolean;
  preventSystemSleep?: boolean;
  audioContext?: boolean;
  userActivity?: boolean;
  fullscreen?: boolean;
}

export class iOSWakeLock {
  constructor(_options: iOSWakeLockOptions = {}) {}

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

let globalIOSWakeLock: iOSWakeLock | null = null;

export function getIOSWakeLock(options?: iOSWakeLockOptions): iOSWakeLock {
  if (!globalIOSWakeLock) {
    globalIOSWakeLock = new iOSWakeLock(options);
  }
  return globalIOSWakeLock;
}

export function cleanupIOSWakeLock(): void {
  if (globalIOSWakeLock) {
    globalIOSWakeLock.release();
    globalIOSWakeLock = null;
  }
}

export default iOSWakeLock;
