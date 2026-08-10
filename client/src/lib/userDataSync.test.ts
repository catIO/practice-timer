import { describe, it, expect, beforeEach, vi } from 'vitest';
import { pullUserDataFromCloud, pushUserDataToCloud } from './userDataSync';
import { getLessonPlan, saveLessonPlan } from './lessonPlan';
import { getPracticePlan, savePracticePlan } from './practicePlan';
import { supabase } from './supabaseClient';
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

vi.mock('./supabaseClient', () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-123' } } },
      }),
    },
    from: vi.fn(),
  };
  return { supabase: mockSupabase };
});

describe('userDataSync cross-device sync', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('pullUserDataFromCloud restores practice plan AND lesson plan data from Supabase', async () => {
    const cloudPracticePlan: PlanItem[] = [
      { id: 'p1', text: 'Cloud Practice Step', checked: false, children: [], blockType: 'heading1' },
    ];
    const cloudLessonPlan: PlanItem[] = [
      { id: 'l1', text: 'Cloud Lesson Note', checked: false, children: [], blockType: 'heading1' },
    ];

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            plan_data: cloudPracticePlan,
            lesson_plan_data: cloudLessonPlan,
            logs_data: {},
            completions_data: {},
          },
          error: null,
        }),
      }),
    });

    (supabase as any).from.mockReturnValue({
      select: mockSelect,
    });

    const success = await pullUserDataFromCloud();
    expect(success).toBe(true);

    const restoredLessonPlan = getLessonPlan();
    expect(restoredLessonPlan).toEqual(cloudLessonPlan);

    const restoredPracticePlan = getPracticePlan();
    expect(restoredPracticePlan).toEqual(cloudPracticePlan);
  });

  it('pushUserDataToCloud includes both practice plan and lesson plan data', async () => {
    const localLessonPlan: PlanItem[] = [
      { id: 'l-local', text: 'My Local Lesson Note', checked: false, children: [], blockType: 'heading1' },
    ];
    saveLessonPlan(localLessonPlan);

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    (supabase as any).from.mockReturnValue({
      upsert: mockUpsert,
    });

    const success = await pushUserDataToCloud();
    expect(success).toBe(true);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'test-user-123',
        lesson_plan_data: localLessonPlan,
        plan_data: expect.any(Array),
      }),
      { onConflict: 'user_id' }
    );
  });
});
