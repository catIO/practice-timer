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

    useTimerStore.setState({
      isRunning: false,
      pieceOvertimeRunning: false,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not request wake lock when keepScreenAwake is true but no timer is running', () => {
    renderHook(() => useGlobalWakeLock());
    expect(requestSpy).not.toHaveBeenCalled();
    expect(releaseSpy).toHaveBeenCalled();
  });

  it('requests wake lock when keepScreenAwake is true and isRunning is true', () => {
    useTimerStore.setState({
      isRunning: true,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    renderHook(() => useGlobalWakeLock());
    expect(requestSpy).toHaveBeenCalled();
  });

  it('requests wake lock when keepScreenAwake is true and pieceOvertimeRunning is true', () => {
    useTimerStore.setState({
      isRunning: false,
      pieceOvertimeRunning: true,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    renderHook(() => useGlobalWakeLock());
    expect(requestSpy).toHaveBeenCalled();
  });

  it('does not request wake lock when timer is running but keepScreenAwake is false', () => {
    useTimerStore.setState({
      isRunning: true,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: false
      }
    });

    renderHook(() => useGlobalWakeLock());
    expect(requestSpy).not.toHaveBeenCalled();
    expect(releaseSpy).toHaveBeenCalled();
  });

  it('releases wake lock when timer is paused (isRunning toggled to false)', () => {
    useTimerStore.setState({
      isRunning: true,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    const { rerender } = renderHook(() => useGlobalWakeLock());
    expect(requestSpy).toHaveBeenCalled();
    releaseSpy.mockClear();

    act(() => {
      useTimerStore.setState({ isRunning: false });
    });

    rerender();
    expect(releaseSpy).toHaveBeenCalled();
  });

  it('releases wake lock when piece overtime stops', () => {
    useTimerStore.setState({
      isRunning: false,
      pieceOvertimeRunning: true,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    const { rerender } = renderHook(() => useGlobalWakeLock());
    expect(requestSpy).toHaveBeenCalled();
    releaseSpy.mockClear();

    act(() => {
      useTimerStore.setState({ pieceOvertimeRunning: false });
    });

    rerender();
    expect(releaseSpy).toHaveBeenCalled();
  });

  it('releases wake lock when keepScreenAwake is toggled to false while running', () => {
    useTimerStore.setState({
      isRunning: true,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    const { rerender } = renderHook(() => useGlobalWakeLock());
    expect(requestSpy).toHaveBeenCalled();
    releaseSpy.mockClear();

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

  it('re-requests wake lock on visibilitychange only when timer is running and setting is enabled', () => {
    useTimerStore.setState({
      isRunning: true,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    renderHook(() => useGlobalWakeLock());
    requestSpy.mockClear();

    // Trigger visibilitychange with visible state
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(requestSpy).toHaveBeenCalled();

    // If timer is not running, visibility change should not request wake lock
    act(() => {
      useTimerStore.setState({ isRunning: false });
    });
    requestSpy.mockClear();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('releases wake lock on unmount', () => {
    useTimerStore.setState({
      isRunning: true,
      settings: {
        ...useTimerStore.getState().settings,
        keepScreenAwake: true
      }
    });

    const { unmount } = renderHook(() => useGlobalWakeLock());
    releaseSpy.mockClear();
    unmount();
    expect(releaseSpy).toHaveBeenCalled();
  });
});

