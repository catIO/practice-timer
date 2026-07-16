import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSettings, saveSettings, getTimerProgress, saveTimerProgress, clearTimerProgress } from './localStorage';
import { DEFAULT_SETTINGS } from './timerService';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('localStorage utilities', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('getSettings', () => {
        it('returns default settings when nothing stored', () => {
            const settings = getSettings();
            expect(settings).toEqual(DEFAULT_SETTINGS);
        });

        it('merges stored settings with defaults', () => {
            localStorageMock.setItem(
                'practice-timer-settings',
                JSON.stringify({ workDuration: 30, volume: 80 })
            );
            const settings = getSettings();
            expect(settings.workDuration).toBe(30);
            expect(settings.volume).toBe(80);
            expect(settings.breakDuration).toBe(DEFAULT_SETTINGS.breakDuration);
        });

        it('returns defaults on parse error', () => {
            localStorageMock.setItem('practice-timer-settings', 'invalid json');
            const settings = getSettings();
            expect(settings).toEqual(DEFAULT_SETTINGS);
        });
    });

    describe('saveSettings', () => {
        it('serializes settings to localStorage', () => {
            const custom = { ...DEFAULT_SETTINGS, workDuration: 45 };
            saveSettings(custom);
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'practice-timer-settings',
                JSON.stringify(custom)
            );
        });
    });

    describe('TimerProgress', () => {
        const progress = {
            timeRemaining: 300,
            totalTime: 1200,
            mode: 'work' as const,
            currentIteration: 2,
            totalIterations: 6,
            isPracticeComplete: false,
        };

        it('returns null when no progress stored', () => {
            expect(getTimerProgress()).toBeNull();
        });

        it('saves and retrieves timer progress', () => {
            saveTimerProgress(progress);
            const result = getTimerProgress();
            expect(result).toEqual(progress);
        });

        it('clears timer progress', () => {
            saveTimerProgress(progress);
            clearTimerProgress();
            expect(getTimerProgress()).toBeNull();
        });
    });
});
