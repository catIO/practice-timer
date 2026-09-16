import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IOSBackgroundTimer, {
    cleanupIOSBackgroundTimer,
    getIOSBackgroundTimer,
    initializeIOSBackgroundTimer,
    type iOSBackgroundTimerCallbacks,
} from './iOSBackgroundTimer';

const START = new Date('2026-09-16T12:00:00Z').getTime();
const STORAGE_KEY = 'iOSBackgroundTimerState';

describe('iOSBackgroundTimer elapsed-time recovery (simulated clock, not OS suspension)', () => {
    let timers: IOSBackgroundTimer[];
    let hidden: boolean;
    let resources: ReturnType<typeof observeResources>;

    function observeResources() {
        return {
            documentListeners: vi.spyOn(document, 'addEventListener'),
            windowListeners: vi.spyOn(window, 'addEventListener'),
            scheduledIntervals: vi.spyOn(window, 'setInterval'),
            clearedIntervals: vi.spyOn(globalThis, 'clearInterval'),
        };
    }

    function activeIntervalCount() {
        // Count the helper's actual interval handles, not unrelated jsdom
        // timeouts (for example asynchronous localStorage storage events).
        return resources.scheduledIntervals.mock.results.filter(({ value }) =>
            !resources.clearedIntervals.mock.calls.some(([id]) => id === value)).length;
    }

    function createTimer(callbacks: iOSBackgroundTimerCallbacks = {}) {
        const timer = new IOSBackgroundTimer({}, callbacks);
        timers.push(timer);
        return timer;
    }

    function setHidden(value: boolean) {
        hidden = value;
        document.dispatchEvent(new Event('visibilitychange'));
    }

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(START);
        localStorage.clear();
        timers = [];
        hidden = false;
        vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
        // Do not attempt actual audio playback or depend on a browser AudioContext.
        vi.stubGlobal('AudioContext', undefined);
        vi.stubGlobal('webkitAudioContext', undefined);
        resources = observeResources();
    });

    afterEach(() => {
        cleanupIOSBackgroundTimer();
        for (const timer of timers) timer.cleanup();
        // Defensive test isolation, including when a lifecycle assertion fails.
        for (const [type, listener, options] of resources.documentListeners.mock.calls) {
            document.removeEventListener(type, listener, options);
        }
        for (const [type, listener, options] of resources.windowListeners.mock.calls) {
            window.removeEventListener(type, listener, options);
        }
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        localStorage.clear();
    });

    it.each(['work', 'break'] as const)('recovers %s elapsed time on foreground without replaying missed intervals', async (mode) => {
        const onTick = vi.fn();
        const onBackground = vi.fn();
        const onForeground = vi.fn();
        const timer = createTimer({ onTick, onBackground, onForeground });
        timer.start(120, mode, 2, 4);
        await vi.advanceTimersByTimeAsync(5000);
        expect(onTick).toHaveBeenCalledTimes(5);
        expect(timer.getState().timeRemaining).toBe(115);
        setHidden(true);
        setHidden(true);
        expect(onBackground).toHaveBeenCalledTimes(1);

        // Jump wall-clock time without executing any scheduled callbacks: this
        // represents a throttled/suspended JS runtime, not a real iOS device.
        vi.setSystemTime(START + 45_000);
        expect(onTick).toHaveBeenCalledTimes(5);
        expect(timer.getState().timeRemaining).toBe(115);
        setHidden(false);
        expect(timer.getState()).toMatchObject({
            isRunning: true, mode, currentIteration: 2, totalIterations: 4,
            duration: 120, timeRemaining: 75, driftCorrection: -40,
            lastUpdateTime: START + 45_000, lastSyncTime: START + 45_000,
        });
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
            mode, timeRemaining: 75, persistedAt: START + 45_000,
        });
        setHidden(false);
        expect(onForeground).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(onTick).toHaveBeenLastCalledWith(74);
        expect(timer.getState().timeRemaining).toBe(74);
    });

    it.each(['work', 'break'] as const)('completes expired %s once after returning from background', async (mode) => {
        const onComplete = vi.fn();
        const timer = createTimer({ onComplete });
        timer.start(30, mode, 2, 4);
        setHidden(true);
        vi.setSystemTime(START + 90_000);
        setHidden(false);
        expect(timer.getState()).toMatchObject({ isRunning: false, timeRemaining: 0, mode });
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
            isRunning: false, timeRemaining: 0, mode, currentIteration: 2, totalIterations: 4,
        }));
        expect(activeIntervalCount()).toBe(0);
        timer.syncWithRealTime();
        setHidden(false);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ isRunning: false, timeRemaining: 0 });
    });

    it.each(['work', 'break'] as const)('excludes paused elapsed time when resuming %s', async (mode) => {
        const onPause = vi.fn();
        const onResume = vi.fn();
        const timer = createTimer({ onPause, onResume });
        timer.start(120, mode, 1, 4);
        await vi.advanceTimersByTimeAsync(5000);
        timer.pause();
        expect(onPause).toHaveBeenCalledTimes(1);
        expect(timer.getState()).toMatchObject({ isRunning: false, timeRemaining: 115 });
        await vi.advanceTimersByTimeAsync(60_000);
        expect(timer.calculateTimeRemaining()).toBe(115);
        timer.resume();
        expect(onResume).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000);
        expect(timer.getState()).toMatchObject({ isRunning: true, mode, timeRemaining: 114 });
    });

    it('recovers elapsed time from a persisted running timer into a new instance', () => {
        const original = createTimer();
        original.start(120, 'break', 3, 4);
        vi.setSystemTime(START + 35_900);
        const restored = createTimer();
        expect(restored.loadPersistedState()).toBe(true);
        expect(restored.getState()).toMatchObject({
            isRunning: true, mode: 'break', currentIteration: 3,
            totalIterations: 4, duration: 120, timeRemaining: 85,
            startTime: START, lastSyncTime: START + 35_900,
        });
        expect(restored.getState()).not.toHaveProperty('persistedAt');
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ timeRemaining: 85 });
    });

    it('restores a paused timer without subtracting time spent away', async () => {
        const original = createTimer();
        original.start(120, 'work', 1, 4);
        await vi.advanceTimersByTimeAsync(7000);
        original.pause();
        vi.setSystemTime(START + 600_000);
        const restored = createTimer();
        expect(restored.loadPersistedState()).toBe(true);
        restored.syncWithRealTime();
        expect(restored.getState()).toMatchObject({ isRunning: false, timeRemaining: 113, mode: 'work' });
        expect(restored.calculateTimeRemaining()).toBe(113);
        expect(activeIntervalCount()).toBe(0);
    });

    it('completes an already-expired persisted timer once when loading', () => {
        createTimer().start(30, 'work', 1, 4);
        vi.setSystemTime(START + 31_000);
        const onComplete = vi.fn();
        const restored = createTimer({ onComplete });
        expect(restored.loadPersistedState()).toBe(true);
        expect(restored.getState()).toMatchObject({ isRunning: false, timeRemaining: 0 });
        expect(restored.loadPersistedState()).toBe(true);
        restored.syncWithRealTime();
        expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('recovers elapsed time through blur/focus without duplicate visibility callbacks', () => {
        const onBackground = vi.fn();
        const onForeground = vi.fn();
        const timer = createTimer({ onBackground, onForeground });
        timer.start(60, 'work', 1, 4);
        window.dispatchEvent(new Event('blur'));
        setHidden(true);
        vi.setSystemTime(START + 12_000);
        window.dispatchEvent(new Event('focus'));
        setHidden(false);
        expect(timer.getState().timeRemaining).toBe(48);
        expect(onBackground).toHaveBeenCalledTimes(1);
        expect(onForeground).toHaveBeenCalledTimes(1);
        expect(activeIntervalCount()).toBe(1);
    });

    it('returns false for missing or malformed persisted data without changing state', () => {
        const timer = createTimer();
        const initial = timer.getState();
        expect(timer.loadPersistedState()).toBe(false);
        localStorage.setItem(STORAGE_KEY, '{invalid JSON');
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(timer.loadPersistedState()).toBe(false);
        expect(error).toHaveBeenCalledTimes(1);
        expect(timer.getState()).toEqual(initial);
    });

    it('shares one global helper and stops both intervals when cleaned up', async () => {
        const onTick = vi.fn();
        const onComplete = vi.fn();
        expect(getIOSBackgroundTimer()).toBeNull();
        const timer = initializeIOSBackgroundTimer({ onTick, onComplete });
        expect(initializeIOSBackgroundTimer()).toBe(timer);
        expect(getIOSBackgroundTimer()).toBe(timer);
        timer.start(60, 'work', 1, 4);
        setHidden(true);
        expect(activeIntervalCount()).toBe(2);
        cleanupIOSBackgroundTimer();
        expect(getIOSBackgroundTimer()).toBeNull();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(activeIntervalCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(onTick).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('does not add previously recovered time back on a second background visit', async () => {
        const onTick = vi.fn();
        const timer = createTimer({ onTick });
        timer.start(120, 'work', 1, 4);
        setHidden(true);
        vi.setSystemTime(START + 30_000);
        setHidden(false);
        expect(timer.getState().timeRemaining).toBe(90);
        setHidden(true);
        onTick.mockClear();
        await vi.advanceTimersByTimeAsync(1000);
        expect(timer.getState().timeRemaining).toBe(89);
        expect(onTick.mock.calls.every(([remaining]) => remaining === 89)).toBe(true);
    });

    it('detaches all lifecycle listeners on cleanup', () => {
        const onBackground = vi.fn();
        const onForeground = vi.fn();
        const timer = createTimer({ onBackground, onForeground });
        timer.start(60, 'work', 1, 4);
        timer.cleanup();
        setHidden(true);
        setHidden(false);
        window.dispatchEvent(new Event('blur'));
        window.dispatchEvent(new Event('focus'));
        window.dispatchEvent(new Event('beforeunload'));
        expect(onBackground).not.toHaveBeenCalled();
        expect(onForeground).not.toHaveBeenCalled();
        expect(activeIntervalCount()).toBe(0);
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});