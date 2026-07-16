import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getPracticeLog,
    addPracticeTime,
    getDailyBreakdown,
    getTotalSeconds,
    getTodaySeconds,
    formatDuration,
    formatDate,
    addDetailedPracticeTime,
    getDetailedPracticeLog,
} from './practiceLog';

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

describe('practiceLog', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('getPracticeLog', () => {
        it('returns empty object when nothing stored', () => {
            expect(getPracticeLog()).toEqual({});
        });

        it('returns stored log', () => {
            localStorageMock.setItem('practice-timer-log', JSON.stringify({ '2025-01-15': 1200 }));
            expect(getPracticeLog()).toEqual({ '2025-01-15': 1200 });
        });
    });

    describe('addPracticeTime', () => {
        it('adds time to today', () => {
            addPracticeTime(600);
            addPracticeTime(300);
            const log = getPracticeLog();
            const today = Object.keys(log)[0];
            expect(log[today]).toBe(900);
        });
    });

    describe('getDailyBreakdown', () => {
        it('returns sorted daily entries', () => {
            localStorageMock.setItem('practice-timer-log', JSON.stringify({
                '2025-01-10': 600,
                '2025-01-12': 1200,
                '2025-01-11': 900,
            }));
            const breakdown = getDailyBreakdown();
            expect(breakdown).toHaveLength(3);
            expect(breakdown[0].date).toBe('2025-01-12'); // Most recent first
            expect(breakdown[2].date).toBe('2025-01-10');
        });
    });

    describe('getTotalSeconds', () => {
        it('sums all days', () => {
            localStorageMock.setItem('practice-timer-log', JSON.stringify({
                '2025-01-10': 600,
                '2025-01-11': 900,
                '2025-01-12': 1200,
            }));
            expect(getTotalSeconds()).toBe(2700);
        });

        it('returns 0 when no data', () => {
            expect(getTotalSeconds()).toBe(0);
        });
    });

    describe('getTodaySeconds', () => {
        it('returns 0 when no practice today', () => {
            expect(getTodaySeconds()).toBe(0);
        });

        it('returns today total', () => {
            addPracticeTime(500);
            expect(getTodaySeconds()).toBe(500);
        });
    });

    describe('formatDuration', () => {
        it('formats minutes only', () => {
            expect(formatDuration(300)).toBe('5 min');
            expect(formatDuration(0)).toBe('0 min');
        });

        it('formats hours and minutes', () => {
            expect(formatDuration(3600)).toBe('1h 0m');
            expect(formatDuration(5400)).toBe('1h 30m');
            expect(formatDuration(7200)).toBe('2h 0m');
        });
    });

    describe('formatDate', () => {
        it('returns "Today" for current date', () => {
            const today = new Date();
            const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            expect(formatDate(dateStr)).toBe('Today');
        });

        it('returns "Yesterday" for previous date', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            expect(formatDate(dateStr)).toBe('Yesterday');
        });

        it('returns formatted date for older dates', () => {
            const result = formatDate('2024-01-01');
            expect(result).not.toBe('Today');
            expect(result).not.toBe('Yesterday');
            expect(typeof result).toBe('string');
        });
    });

    describe('addDetailedPracticeTime', () => {
        it('records time for a specific piece', () => {
            addDetailedPracticeTime('piece-1', 'Bach Prelude', 300);
            addDetailedPracticeTime('piece-1', 'Bach Prelude', 200);
            const log = getDetailedPracticeLog();
            const today = Object.keys(log)[0];
            expect(log[today]['piece-1'].seconds).toBe(500);
            expect(log[today]['piece-1'].itemName).toBe('Bach Prelude');
        });

        it('tracks multiple pieces independently', () => {
            addDetailedPracticeTime('piece-1', 'Bach', 300);
            addDetailedPracticeTime('piece-2', 'Mozart', 600);
            const log = getDetailedPracticeLog();
            const today = Object.keys(log)[0];
            expect(log[today]['piece-1'].seconds).toBe(300);
            expect(log[today]['piece-2'].seconds).toBe(600);
        });
    });
});
