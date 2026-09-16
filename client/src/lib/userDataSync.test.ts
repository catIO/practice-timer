import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('pullUserDataFromCloud restores practice plan AND lesson plan data from Supabase', async () => {
    const cloudPracticePlan: PlanItem[] = [
      { id: 'p1', text: 'Cloud Practice Step', checked: false, children: [], blockType: 'heading1', isHeader: true },
    ];
    const cloudLessonPlan: PlanItem[] = [
      { id: 'l1', text: 'Cloud Lesson Note', checked: false, children: [], blockType: 'heading1', isHeader: true },
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
    // Remote hydration must not schedule a write of stale local domains.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uploads local data when the user has no cloud row', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    (supabase as any).from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert,
    });

    expect(await pullUserDataFromCloud()).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'test-user-123',
      plan_data: expect.any(Array),
      lesson_plan_data: expect.any(Array),
    }));
  });

  it('reports first-upload failure and permits a subsequent retry', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'Offline' } });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    (supabase as any).from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert,
      upsert,
    });
    const onSynced = vi.fn();
    window.addEventListener('plan-data-synced', onSynced);
    try {
      expect(await pullUserDataFromCloud()).toBe(false);
      expect(onSynced).not.toHaveBeenCalled();
      expect(await pushUserDataToCloud()).toBe(true);
      expect(insert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('plan-data-synced', onSynced);
    }
  });

  it('does not overwrite a row created by another device during initial sync', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: '23505', message: 'Duplicate user' } });
    const upsert = vi.fn();
    (supabase as any).from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert,
      upsert,
    });
    expect(await pullUserDataFromCloud()).toBe(false);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('pushUserDataToCloud includes both practice plan and lesson plan data', async () => {
    const localLessonPlan: PlanItem[] = [
      { id: 'l-local', text: 'My Local Lesson Note', checked: false, children: [], blockType: 'heading1', isHeader: true },
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

  it('pushUserDataToCloud aborts push when practice plan and lesson plan are identical non-empty arrays', async () => {
    const identicalPlan: PlanItem[] = [
      { id: 'item-1', text: 'Sample Item', checked: false, children: [], blockType: 'heading1', isHeader: true },
    ];
    savePracticePlan(identicalPlan);
    saveLessonPlan(identicalPlan);

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    (supabase as any).from.mockReturnValue({
      upsert: mockUpsert,
    });

    const success = await pushUserDataToCloud();
    expect(success).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
