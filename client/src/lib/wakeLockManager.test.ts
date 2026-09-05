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

  it('configures fallback video within viewport for WebKit power management', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
      writable: true
    });

    const playMock = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pauseMock = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});

    await requestWakeLock();

    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).not.toBeNull();
    expect(video.style.position).toBe('fixed');
    expect(video.style.bottom).toBe('0px');
    expect(video.style.right).toBe('0px');
    expect(video.style.opacity).toBe('0.001');
    expect(video.style.pointerEvents).toBe('none');
    expect(video.getAttribute('aria-hidden')).toBe('true');
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);

    await releaseWakeLock();
    playMock.mockRestore();
    pauseMock.mockRestore();
  });

  it('attempts re-acquisition when native sentinel releases unexpectedly', async () => {
    let releaseHandler: (() => void) | undefined;
    const releaseMock = vi.fn().mockResolvedValue(undefined);
    const addEventListenerMock = vi.fn((event: string, handler: () => void) => {
      if (event === 'release') {
        releaseHandler = handler;
      }
    });

    const mockSentinel1 = {
      released: false,
      release: releaseMock,
      addEventListener: addEventListenerMock
    };

    const mockSentinel2 = {
      released: false,
      release: releaseMock,
      addEventListener: vi.fn()
    };

    const requestMock = vi.fn()
      .mockResolvedValueOnce(mockSentinel1)
      .mockResolvedValueOnce(mockSentinel2);

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: requestMock },
      configurable: true,
      writable: true
    });

    await requestWakeLock();
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(releaseHandler).toBeDefined();

    // Trigger unexpected release while requested (e.g. Safari multitasking / lock)
    if (releaseHandler) {
      releaseHandler();
    }

    // Should attempt re-acquisition
    expect(requestMock).toHaveBeenCalledTimes(2);

    await releaseWakeLock();
  });
});
