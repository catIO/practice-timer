import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateId, getPracticePlan, savePracticePlan, type PracticePlanItem } from './practicePlan';

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

describe('practicePlan', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('generateId', () => {
        it('returns a string starting with "plan-"', () => {
            const id = generateId();
            expect(id).toMatch(/^plan-\d+-[a-z0-9]+$/);
        });

        it('generates unique IDs', () => {
            const ids = new Set(Array.from({ length: 100 }, () => generateId()));
            expect(ids.size).toBe(100);
        });
    });

    describe('getPracticePlan', () => {
        it('returns default plan when nothing is stored', () => {
            const plan = getPracticePlan();
            expect(plan.length).toBeGreaterThan(0);
            plan.forEach((item) => {
                expect(item.blockType).toBeDefined();
            });
        });

        it('loads and normalizes stored plan', () => {
            const items: PracticePlanItem[] = [
                { id: '1', text: 'Scales', checked: false, children: [] },
                { id: '2', text: 'Etudes', checked: true, children: [] },
            ];
            localStorageMock.setItem('practice-timer-plan', JSON.stringify(items));

            const plan = getPracticePlan();
            expect(plan).toHaveLength(2);
            expect(plan[0].blockType).toBe('todo'); // normalized
            expect(plan[1].checked).toBe(true);
        });

        it('handles invalid JSON gracefully', () => {
            localStorageMock.setItem('practice-timer-plan', 'not json');
            const plan = getPracticePlan();
            // Should fall back to default
            expect(Array.isArray(plan)).toBe(true);
            expect(plan.length).toBeGreaterThan(0);
        });

        it('handles double-encoded JSON', () => {
            const items: PracticePlanItem[] = [
                { id: '1', text: 'Test', checked: false, children: [] },
            ];
            // Double-encode: JSON string inside a JSON string
            localStorageMock.setItem('practice-timer-plan', JSON.stringify(JSON.stringify(items)));
            const plan = getPracticePlan();
            expect(plan).toHaveLength(1);
            expect(plan[0].text).toBe('Test');
        });
    });

    describe('savePracticePlan', () => {
        it('saves items to localStorage', () => {
            const items: PracticePlanItem[] = [
                { id: '1', text: 'Warm up', checked: false, children: [], blockType: 'todo' },
            ];
            savePracticePlan(items);
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'practice-timer-plan',
                JSON.stringify(items)
            );
        });
    });
});
