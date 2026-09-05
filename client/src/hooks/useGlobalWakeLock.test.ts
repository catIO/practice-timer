import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalWakeLock } from './useGlobalWakeLock';
import { useTimerStore } from '@/stores/timerStore';
import * as wakeLockManager from '@/lib/wakeLockManager';

describe('useGlobalWakeLock', () => {
  let requestSpy: any;
  let releaseSpy: any;

  beforeEach(() => {
    requestSpy = vi.spyOn(wakeLockManager, 'requestWakeLock').mockResolvedValue(true);
    releaseSpy = vi.spyOn(wakeLockManager, 'releaseWakeLock').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests wake lock when keepScreenAwake is true', () => {
    useTimerStore.setState({
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    renderHook(() => useGlobalWakeLock());
    expect(requestSpy).toHaveBeenCalled();
  });

  it('releases wake lock when keepScreenAwake is toggled to false', () => {
    useTimerStore.setState({
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    const { rerender } = renderHook(() => useGlobalWakeLock());
    expect(requestSpy).toHaveBeenCalled();

    act(() => {
      useTimerStore.setState({
        settings: {
          ...useTimerStore.getState().settings,
          keepScreenAwake: false
        }
      });
    });

    rerender();
    expect(releaseSpy).toHaveBeenCalled();
  });

  it('releases wake lock on unmount', () => {
    useTimerStore.setState({
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    const { unmount } = renderHook(() => useGlobalWakeLock());
    unmount();
    expect(releaseSpy).toHaveBeenCalled();
  });
});
