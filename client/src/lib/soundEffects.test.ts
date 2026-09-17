import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getNormalizedVolume,
  detectIPad,
  detectIOS,
  getAudioContext,
  unlockAudioContext,
  resumeAudioContext,
  suspendAudioContext,
  startSilenceKeepAlive,
  stopSilenceKeepAlive,
  playSound,
  _resetAudioForTesting,
} from './soundEffects';

describe('soundEffects', () => {
  let mockAudioContext: any;

  beforeEach(() => {
    vi.useFakeTimers();
    _resetAudioForTesting();

    mockAudioContext = {
      state: 'running',
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      resume: vi.fn().mockImplementation(async () => {
        mockAudioContext.state = 'running';
        return undefined;
      }),
      suspend: vi.fn().mockImplementation(async () => {
        mockAudioContext.state = 'suspended';
        return undefined;
      }),
      createBuffer: vi.fn().mockReturnValue({}),
      createBufferSource: vi.fn().mockReturnValue({
        buffer: null,
        loop: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: vi.fn().mockReturnValue({
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      createOscillator: vi.fn().mockReturnValue({
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
    };

    (window as any).AudioContext = vi.fn().mockImplementation(function (this: any) {
      return mockAudioContext;
    });
  });

  afterEach(() => {
    stopSilenceKeepAlive();
    _resetAudioForTesting();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('volume normalization', () => {
    it('normalizes 0-100 range volume quadratically', () => {
      expect(getNormalizedVolume(0)).toBe(0);
      expect(getNormalizedVolume(100)).toBe(1);
      expect(getNormalizedVolume(50)).toBeCloseTo(0.25);
    });

    it('normalizes 0-1 range volume properly', () => {
      expect(getNormalizedVolume(0.5)).toBeCloseTo(0.25);
      expect(getNormalizedVolume(1.0)).toBe(1);
    });
  });

  describe('device detection', () => {
    it('detects iPad userAgent', () => {
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        configurable: true,
      });

      expect(detectIPad()).toBe(true);
      expect(detectIOS()).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    });

    it('detects iPad with desktop Mac userAgent and touch points', () => {
      const originalUA = navigator.userAgent;
      const originalTouchPoints = navigator.maxTouchPoints;

      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        configurable: true,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true,
      });

      expect(detectIPad()).toBe(true);
      expect(detectIOS()).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: originalTouchPoints,
        configurable: true,
      });
    });
  });

  describe('keepalive and suspend lifecycle', () => {
    it('stops silence keepalive without immediately suspending AudioContext', () => {
      startSilenceKeepAlive();
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();

      // Stopping keepalive should clean up the source without calling suspend()
      stopSilenceKeepAlive();
      expect(mockAudioContext.suspend).not.toHaveBeenCalled();
      expect(mockAudioContext.state).toBe('running');
    });

    it('suspendAudioContext suspends when no sounds are playing and keepalive is inactive', async () => {
      stopSilenceKeepAlive();
      await suspendAudioContext();
      expect(mockAudioContext.suspend).toHaveBeenCalled();
      expect(mockAudioContext.state).toBe('suspended');
    });

    it('suspendAudioContext does not suspend while silentSource is active', async () => {
      startSilenceKeepAlive();
      await suspendAudioContext();
      expect(mockAudioContext.suspend).not.toHaveBeenCalled();
      expect(mockAudioContext.state).toBe('running');
    });
  });

  describe('playSound playback', () => {
    it('plays end sound beeps and suspends AudioContext only after all beeps decay', async () => {
      stopSilenceKeepAlive();

      const playPromise = playSound('end', 3, 50, 'beep');

      // While playing, suspendAudioContext should not suspend prematurely
      await suspendAudioContext();
      expect(mockAudioContext.suspend).not.toHaveBeenCalled();

      // Fast forward time through beep 1 (1200ms) + beep 2 (1200ms) + beep 3 decay (1300ms)
      await vi.advanceTimersByTimeAsync(1200);
      await vi.advanceTimersByTimeAsync(1200);
      await vi.advanceTimersByTimeAsync(1300);

      await playPromise;

      // Now that all beeps decayed and no keepalive is running, AudioContext should be suspended
      expect(mockAudioContext.suspend).toHaveBeenCalled();
      expect(mockAudioContext.state).toBe('suspended');
    });

    it('does not suspend AudioContext after sound if silentSource is active', async () => {
      startSilenceKeepAlive();

      const playPromise = playSound('start', 1, 50, 'beep');
      await vi.advanceTimersByTimeAsync(600);
      await playPromise;

      // Keepalive is running, so context must remain running for the ongoing timer
      expect(mockAudioContext.suspend).not.toHaveBeenCalled();
      expect(mockAudioContext.state).toBe('running');
    });

    it('defers keepalive teardown and suspension when stopSilenceKeepAlive is called during sound playback', async () => {
      startSilenceKeepAlive();

      const playPromise = playSound('end', 3, 50, 'beep');

      // Timer finishes and calls stopSilenceKeepAlive while sound is actively playing
      stopSilenceKeepAlive();

      // AudioContext must not be suspended yet while sound is playing
      expect(mockAudioContext.suspend).not.toHaveBeenCalled();
      expect(mockAudioContext.state).toBe('running');

      // Fast forward time through beeps
      await vi.advanceTimersByTimeAsync(3700);
      await playPromise;

      // Once beeps finish, deferred teardown should suspend the context
      expect(mockAudioContext.suspend).toHaveBeenCalled();
      expect(mockAudioContext.state).toBe('suspended');
    });

    it('plays segment-end sound with resonant decay and suspends AudioContext after decay', async () => {
      stopSilenceKeepAlive();

      const playPromise = playSound('segment-end', 1, 50, 'bell');

      // 4 harmonic oscillators should be created for the singing bowl resonance
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(4);
      expect(mockAudioContext.createGain).toHaveBeenCalledTimes(4);

      // Fast forward time through 2800ms decay + 100ms margin
      await vi.advanceTimersByTimeAsync(2900);
      await playPromise;

      expect(mockAudioContext.suspend).toHaveBeenCalled();
      expect(mockAudioContext.state).toBe('suspended');
    });
  });
});
