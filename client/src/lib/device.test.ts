import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectIPad, detectIOS } from './device';

describe('device detection', () => {
  const originalUserAgent = navigator.userAgent;
  const originalMaxTouchPoints = navigator.maxTouchPoints;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
      writable: true,
    });
  });

  it('detects iPadOS with desktop-mode user agent (Macintosh + touch points)', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
      writable: true,
    });

    expect(detectIPad()).toBe(true);
    expect(detectIOS()).toBe(true);
  });

  it('detects standard iPad user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 5,
      configurable: true,
      writable: true,
    });

    expect(detectIPad()).toBe(true);
    expect(detectIOS()).toBe(true);
  });

  it('detects desktop Mac without touch points as non-iPad', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
      writable: true,
    });

    expect(detectIPad()).toBe(false);
  });
});
