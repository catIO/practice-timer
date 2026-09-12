import { useEffect } from 'react';
import { useTimerStore } from '@/stores/timerStore';
import { requestWakeLock, releaseWakeLock } from '@/lib/wakeLockManager';

/**
 * Global hook to manage screen lock prevention across the app.
 * Keeps the screen awake only when `keepScreenAwake` is enabled in settings (defaults to true)
 * AND a timer is actively running (work timer, break timer, or overtime).
 */
export function useGlobalWakeLock(): void {
  const keepScreenAwake = useTimerStore((state) => state.settings?.keepScreenAwake ?? true);
  const isRunning = useTimerStore((state) => state.isRunning);
  const pieceOvertimeRunning = useTimerStore((state) => state.pieceOvertimeRunning);
  const isPiecePaused = useTimerStore((state) => state.isPiecePaused);
  const activePieceId = useTimerStore((state) => state.activePieceId);

  const shouldKeepAwake = keepScreenAwake && ((isRunning && !(activePieceId && isPiecePaused)) || pieceOvertimeRunning);

  useEffect(() => {
    if (shouldKeepAwake) {
      requestWakeLock().catch(() => {});
    } else {
      releaseWakeLock().catch(() => {});
    }
  }, [shouldKeepAwake]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldKeepAwake) {
        requestWakeLock().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shouldKeepAwake]);

  // Release on application unmount
  useEffect(() => {
    return () => {
      releaseWakeLock().catch(() => {});
    };
  }, []);
}
