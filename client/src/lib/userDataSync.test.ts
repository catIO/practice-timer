import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cancelUserDataSync,
  initUserDataSync,
  pullUserDataFromCloud,
  pushUserDataToCloud,
  scheduleUserDataPush,
  setUserDataSyncAccount,
} from './userDataSync';
import { getLessonPlan, saveLessonPlan } from './lessonPlan';
import { getPracticePlan, practicePlanApi, savePracticePlan } from './practicePlan';
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
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
  };
  return { supabase: mockSupabase };
});

describe('userDataSync cross-device sync', () => {
  let stopSync: (() => void) | undefined;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    cancelUserDataSync();
    setUserDataSyncAccount('test-user-123');
    (supabase as any).auth.getSession.mockReset().mockResolvedValue({
      data: { session: { user: { id: 'test-user-123' } } },
    });
    (supabase as any).from.mockReset();
  });

  afterEach(() => {
    stopSync?.();
    stopSync = undefined;
    cancelUserDataSync();
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
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: { message: 'Offline' } })
      .mockResolvedValue({ error: null });
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
      expect(insert).toHaveBeenCalledTimes(2);
      expect(upsert).not.toHaveBeenCalled();
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
    // Retrying initialization must not turn a collision into an overwrite.
    expect(await pushUserDataToCloud()).toBe(false);
    expect(insert).toHaveBeenCalledTimes(2);
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

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
  }

  const plan = (text: string): PlanItem[] => [
    { id: text, text, checked: false, children: [], blockType: 'todo', isHeader: false },
  ];

  function mockCloud() {
    const response = {
      data: { plan_data: plan('Remote'), lesson_plan_data: [], logs_data: {}, completions_data: {} },
      error: null,
    };
    const read = vi.fn().mockResolvedValue(response);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    (supabase as any).from.mockReturnValue({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: read })) })),
      upsert,
      insert,
    });
    return { response, read, upsert, insert };
  }

  it('coalesces overlapping pulls into one request', async () => {
    const { read, response } = mockCloud();
    const pending = deferred<typeof response>();
    read.mockReturnValue(pending.promise);
    const first = pullUserDataFromCloud();
    const second = pullUserDataFromCloud();
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    pending.resolve(response);
    expect(await Promise.all([first, second])).toEqual([true, true]);
  });

  it('queues an upload during a pull and preserves edits made while the pull is in flight', async () => {
    const { read, upsert, response } = mockCloud();
    const pending = deferred<typeof response>();
    read.mockReturnValue(pending.promise);
    const pull = pullUserDataFromCloud();
    await vi.advanceTimersByTimeAsync(0);

    practicePlanApi.save(plan('Local draft'));
    const push = pushUserDataToCloud();
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).not.toHaveBeenCalled();

    pending.resolve(response);
    expect(await pull).toBe(false);
    expect(await push).toBe(true);
    expect(getPracticePlan()).toEqual(plan('Local draft'));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      plan_data: plan('Local draft'),
    }), { onConflict: 'user_id' });
  });

  it('does not start a pull over debounced local edits', async () => {
    const { read } = mockCloud();
    practicePlanApi.save(plan('Pending'));
    expect(await pullUserDataFromCloud()).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(getPracticePlan()).toEqual(plan('Pending'));
  });

  it('does not acknowledge newer edits when an older upload completes', async () => {
    const { upsert, read } = mockCloud();
    const pending = deferred<{ error: null }>();
    upsert.mockReturnValueOnce(pending.promise);
    practicePlanApi.save(plan('First draft'));
    const first = pushUserDataToCloud();
    await vi.advanceTimersByTimeAsync(0);

    practicePlanApi.save(plan('Second draft'));
    scheduleUserDataPush(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).toHaveBeenCalledTimes(1);
    pending.resolve({ error: null });
    expect(await first).toBe(true);
    expect(await pullUserDataFromCloud()).toBe(false);
    expect(read).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0].plan_data).toEqual(plan('Second draft'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a failed upload pending and retries it automatically on reconnect', async () => {
    const { upsert, read } = mockCloud();
    upsert.mockResolvedValueOnce({ error: { message: 'Offline' } });
    stopSync = initUserDataSync();
    practicePlanApi.save(plan('Offline draft'));
    expect(await pushUserDataToCloud()).toBe(false);
    expect(await pullUserDataFromCloud()).toBe(false);
    expect(read).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0].plan_data).toEqual(plan('Offline draft'));
    expect(read).not.toHaveBeenCalled();
  });

  it('retries a rejected upload on focus without wedging the queue', async () => {
    const { upsert } = mockCloud();
    upsert.mockRejectedValueOnce(new Error('Network unavailable'));
    stopSync = initUserDataSync();
    practicePlanApi.save(plan('Draft'));
    expect(await pushUserDataToCloud()).toBe(false);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('restores intentional empty plans but leaves missing plan fields alone', async () => {
    const { read } = mockCloud();
    savePracticePlan(plan('Old practice'));
    saveLessonPlan(plan('Old lesson'));
    read.mockResolvedValueOnce({ data: { plan_data: [], lesson_plan_data: [] }, error: null });
    expect(await pullUserDataFromCloud()).toBe(true);
    expect(getPracticePlan()).toEqual([]);
    expect(getLessonPlan()).toEqual([]);

    savePracticePlan(plan('Keep practice'));
    saveLessonPlan(plan('Keep lesson'));
    read.mockResolvedValueOnce({ data: { plan_data: null }, error: null });
    expect(await pullUserDataFromCloud()).toBe(true);
    expect(getPracticePlan()).toEqual(plan('Keep practice'));
    expect(getLessonPlan()).toEqual(plan('Keep lesson'));
  });

  it('discards a late pull after sign-out and cancels its queued upload', async () => {
    const { read, upsert, response } = mockCloud();
    const pending = deferred<typeof response>();
    read.mockReturnValue(pending.promise);
    const pull = pullUserDataFromCloud();
    await vi.advanceTimersByTimeAsync(0);
    practicePlanApi.save(plan('Keep locally'));
    const push = pushUserDataToCloud();

    cancelUserDataSync();
    pending.resolve(response);
    expect(await pull).toBe(false);
    expect(await push).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(getPracticePlan()).toEqual(plan('Keep locally'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rechecks the session before applying a response even without an auth notification', async () => {
    const { read, response } = mockCloud();
    const pending = deferred<typeof response>();
    read.mockReturnValue(pending.promise);
    savePracticePlan(plan('Keep locally'));
    const pull = pullUserDataFromCloud();
    await vi.advanceTimersByTimeAsync(0);
    (supabase as any).auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'other-user' } } },
    });
    pending.resolve(response);
    expect(await pull).toBe(false);
    expect(getPracticePlan()).toEqual(plan('Keep locally'));
  });

  it('does not acknowledge an old account upload after an account switch', async () => {
    const { upsert } = mockCloud();
    const pending = deferred<{ error: null }>();
    upsert.mockReturnValueOnce(pending.promise);
    const oldPush = pushUserDataToCloud();
    await vi.advanceTimersByTimeAsync(0);
    setUserDataSyncAccount('other-user');
    (supabase as any).auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'other-user' } } },
    });
    practicePlanApi.save(plan('New account draft'));
    pending.resolve({ error: null });
    expect(await oldPush).toBe(false);
    expect(await pullUserDataFromCloud()).toBe(false);
    expect(getPracticePlan()).toEqual(plan('New account draft'));
  });

  it('installs listeners once, removes them on cleanup, and supports a fresh mount', async () => {
    const { read, upsert } = mockCloud();
    stopSync = initUserDataSync();
    expect(initUserDataSync()).toBe(stopSync);
    expect((supabase as any).auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    const subscription = (supabase as any).auth.onAuthStateChange.mock.results[0].value.data.subscription;
    stopSync();
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(read).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();

    stopSync = initUserDataSync();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledOnce();
  });

  it('preserves pending edits across a lifecycle remount and discards the old response', async () => {
    const { read, upsert, response } = mockCloud();
    const pending = deferred<typeof response>();
    read.mockReturnValueOnce(pending.promise);
    stopSync = initUserDataSync();
    const pull = pullUserDataFromCloud();
    await vi.advanceTimersByTimeAsync(0);
    practicePlanApi.save(plan('Survives remount'));
    stopSync();
    stopSync = initUserDataSync();
    pending.resolve(response);
    expect(await pull).toBe(false);
    expect(getPracticePlan()).toEqual(plan('Survives remount'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0].plan_data).toEqual(plan('Survives remount'));
  });

  it('does not upload an unchanged row simply because the page is hidden', async () => {
    const { upsert } = mockCloud();
    stopSync = initUserDataSync();
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).not.toHaveBeenCalled();

    practicePlanApi.save(plan('Pending on background'));
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(0);
    expect(upsert).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
