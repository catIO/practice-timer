import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getLessonPlan, saveLessonPlan, lessonPlanApi } from './lessonPlan';
import { createReportSnapshot } from './reportShare';
import type { PlanItem } from './planTypes';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
} else {
  (globalThis as any).localStorage = localStorageMock;
}

describe('lessonPlan API & report integration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns default lesson plan when empty', () => {
    const plan = getLessonPlan();
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].text).toContain('Lesson 1');
  });

  it('saves and retrieves lesson plan items', () => {
    const customPlan: PlanItem[] = [
      {
        id: 'test-1',
        text: 'My Custom Lesson Header',
        checked: false,
        children: [],
        blockType: 'heading1',
        isHeader: true,
      },
    ];
    saveLessonPlan(customPlan);
    const retrieved = getLessonPlan();
    expect(retrieved).toEqual(customPlan);
  });

  it('modifies text and toggles checks with checkedDate via API', () => {
    const initial = getLessonPlan();
    const id = initial[0].children[0]?.id;
    expect(id).toBeDefined();
    if (!id) return;

    const updated = lessonPlanApi.updateText(initial, id, 'Updated Task');
    expect(updated[0].children[0].text).toBe('Updated Task');

    const checked = lessonPlanApi.toggleCheck(updated, id);
    expect(checked[0].children[0].checked).toBe(true);
    expect(checked[0].children[0].checkedDate).toBeDefined();
    expect(new Date(checked[0].children[0].checkedDate!).getTime()).not.toBeNaN();

    const unchecked = lessonPlanApi.toggleCheck(checked, id);
    expect(unchecked[0].children[0].checked).toBe(false);
    expect(unchecked[0].children[0].checkedDate).toBeUndefined();
  });

  it('resets checkedDate when resetting checks', () => {
    const initial = getLessonPlan();
    const id = initial[0].children[0]?.id;
    expect(id).toBeDefined();
    if (!id) return;

    const checked = lessonPlanApi.checkItem(initial, id);
    expect(checked[0].children[0].checked).toBe(true);
    expect(checked[0].children[0].checkedDate).toBeDefined();

    const reset = lessonPlanApi.resetChecks(checked);
    expect(reset[0].children[0].checked).toBe(false);
    expect(reset[0].children[0].checkedDate).toBeUndefined();
  });

  it('includes lesson plan items, checked status, and checkedDate in created report snapshot', () => {
    const practiceItems: PlanItem[] = [
      { id: 'p1', text: 'Practice Session 1', checked: false, children: [], blockType: 'heading1' },
    ];
    const lessonItems: PlanItem[] = [
      {
        id: 'l1',
        text: 'Lesson Goal 1',
        checked: true,
        checkedDate: '2026-08-15T12:00:00.000Z',
        children: [
          {
            id: 'l2',
            text: 'Sub goal 1',
            checked: false,
            children: [],
            blockType: 'todo',
          },
        ],
        blockType: 'todo',
      },
    ];

    const snapshot = createReportSnapshot(practiceItems, 'Test Report', undefined, undefined, undefined, lessonItems);
    expect(snapshot.items[0].text).toBe('Practice Session 1');
    expect(snapshot.lessonPlanItems).toBeDefined();
    expect(snapshot.lessonPlanItems![0].text).toBe('Lesson Goal 1');
    expect(snapshot.lessonPlanItems![0].checked).toBe(true);
    expect(snapshot.lessonPlanItems![0].checkedDate).toBe('2026-08-15T12:00:00.000Z');
    expect(snapshot.lessonPlanItems![0].children[0].text).toBe('Sub goal 1');
    expect(snapshot.lessonPlanItems![0].children[0].checked).toBe(false);
  });
});
