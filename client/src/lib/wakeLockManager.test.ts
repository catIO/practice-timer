import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { wakeLockManager, requestWakeLock, releaseWakeLock, isWakeLockActive } from './wakeLockManager';

describe('wakeLockManager', () => {
  beforeEach(async () => {
    await releaseWakeLock();
    document.documentElement.removeAttribute('data-wake-lock');
  });

  afterEach(async () => {
    await releaseWakeLock();
  });

  it('tracks active state when acquired and released', async () => {
    expect(isWakeLockActive()).toBe(false);

    // Mock navigator.wakeLock
    const releaseMock = vi.fn().mockResolvedValue(undefined);
    const mockSentinel = {
      released: false,
      release: releaseMock,
      addEventListener: vi.fn()
    };
    const requestMock = vi.fn().mockResolvedValue(mockSentinel);

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: requestMock },
      configurable: true,
      writable: true
    });

    const success = await requestWakeLock();
    expect(success).toBe(true);
    expect(isWakeLockActive()).toBe(true);
    expect(document.documentElement.getAttribute('data-wake-lock')).toBe('active');
    expect(requestMock).toHaveBeenCalledWith('screen');

    await releaseWakeLock();
    expect(isWakeLockActive()).toBe(false);
    expect(document.documentElement.getAttribute('data-wake-lock')).toBeNull();
    expect(releaseMock).toHaveBeenCalled();
  });

  it('falls back to video loop when native wakeLock is unavailable', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
      writable: true
    });

    // Mock HTMLMediaElement.prototype.play
    const playMock = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pauseMock = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    const success = await requestWakeLock();
    expect(success).toBe(true);
    expect(isWakeLockActive()).toBe(true);
    expect(document.documentElement.getAttribute('data-wake-lock')).toBe('active');

    await releaseWakeLock();
    expect(isWakeLockActive()).toBe(false);
    expect(document.documentElement.getAttribute('data-wake-lock')).toBeNull();

    playMock.mockRestore();
    pauseMock.mockRestore();
  });
});
