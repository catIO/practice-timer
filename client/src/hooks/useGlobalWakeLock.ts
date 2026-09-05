import { useEffect } from 'react';
import { useTimerStore } from '@/stores/timerStore';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakeLockManager';

/**
 * Global hook to manage screen lock prevention across all pages in the app.
 * Keeps the screen awake whenever `keepScreenAwake` is enabled in settings (defaults to true).
 */
export function useGlobalWakeLock(): void {
  const keepScreenAwake = useTimerStore((state) => state.settings?.keepScreenAwake ?? true);

  useEffect(() => {
    if (keepScreenAwake) {
      requestWakeLock().catch(() => {});
    } else {
      releaseWakeLock().catch(() => {});
    }
  }, [keepScreenAwake]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && keepScreenAwake) {
        requestWakeLock().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [keepScreenAwake]);

  // Release on application unmount
  useEffect(() => {
    return () => {
      releaseWakeLock().catch(() => {});
    };
  }, []);
}
