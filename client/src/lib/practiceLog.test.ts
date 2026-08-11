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
    logSegmentCompletion,
    removeSegmentCompletionToday,
    getSegmentCompletions,
    getSegmentCompletionsForThisWeek,
    getSegmentCompletionsToday,
    hasCompletedSegmentToday,
    getSegmentCompletionsLast7Days,
    getPracticeLogStateForSync,
    restorePracticeLogStateFromSync,
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

    describe('segmentCompletions', () => {
        it('logs segment completions with timestamps', () => {
            const now = Date.now();
            logSegmentCompletion('seg-1', now);
            logSegmentCompletion('seg-1', now + 20000);
            logSegmentCompletion('seg-2', now);

            const completions = getSegmentCompletions();
            expect(completions['seg-1']).toEqual([now, now + 20000]);
            expect(completions['seg-2']).toEqual([now]);
        });

        it('counts completions for current week and last 7 days', () => {
            const now = new Date('2026-08-10T12:00:00Z').getTime(); // Monday
            const twoHoursAgo = now - 2 * 3600 * 1000;
            const tenDaysAgo = now - 10 * 86400 * 1000;

            logSegmentCompletion('seg-1', now);
            logSegmentCompletion('seg-1', twoHoursAgo);
            logSegmentCompletion('seg-1', tenDaysAgo);

            expect(getSegmentCompletionsLast7Days('seg-1', now)).toBe(2);
            expect(getSegmentCompletionsForThisWeek('seg-1', 'monday', now)).toBe(2);
        });

        it('identifies completions for today', () => {
            const now = new Date('2026-08-11T14:30:00Z').getTime();
            const twoHoursAgo = now - 2 * 3600 * 1000; // Same day (2026-08-11)
            const yesterday = now - 26 * 3600 * 1000;  // Previous day (2026-08-10)

            logSegmentCompletion('seg-1', twoHoursAgo);
            logSegmentCompletion('seg-1', yesterday);

            expect(getSegmentCompletionsToday('seg-1', now)).toBe(1);
            expect(hasCompletedSegmentToday('seg-1', now)).toBe(true);
            expect(getSegmentCompletionsToday('seg-2', now)).toBe(0);
            expect(hasCompletedSegmentToday('seg-2', now)).toBe(false);
        });

        it('does not mark segment as completed when starting practice now without completing it', () => {
            const now = new Date('2026-08-11T14:30:00Z').getTime();
            addDetailedPracticeTime('seg-3', 'Scales', 10); // Practiced for 10 seconds (in-progress/started)

            expect(getSegmentCompletionsToday('seg-3', now)).toBe(0);
            expect(hasCompletedSegmentToday('seg-3', now)).toBe(false);
            expect(getSegmentCompletionsForThisWeek('seg-3', 'monday', now)).toBe(0);
        });

        it('removes today completion when unchecking a segment', () => {
            const now = new Date('2026-08-11T14:30:00Z').getTime();
            logSegmentCompletion('seg-4', now);
            expect(hasCompletedSegmentToday('seg-4', now)).toBe(true);

            removeSegmentCompletionToday('seg-4', now);
            expect(hasCompletedSegmentToday('seg-4', now)).toBe(false);
            expect(getSegmentCompletionsToday('seg-4', now)).toBe(0);
        });

        it('supports state sync export and restore', () => {
            logSegmentCompletion('seg-1', 1234567);
            addPracticeTime(600);

            const snapshot = getPracticeLogStateForSync();
            expect(snapshot.completions['seg-1']).toEqual([1234567]);

            localStorageMock.clear();
            expect(getSegmentCompletions()).toEqual({});

            restorePracticeLogStateFromSync(snapshot);
            expect(getSegmentCompletions()['seg-1']).toEqual([1234567]);
        });
    });
});
