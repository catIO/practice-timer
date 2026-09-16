import { supabase } from './supabaseClient';
import { getPracticePlan, savePracticePlan } from './practicePlan';
import { getLessonPlan, saveLessonPlan } from './lessonPlan';
import {
  getPracticeLogStateForSync,
  restorePracticeLogStateFromSync,
} from './practiceLog';
import { onAuthStateChange } from './authService';
import { createSyncScheduler } from './syncScheduler';

interface SyncState {
  userId: string | null | undefined;
  revision: number;
  acknowledgedRevision: number;
  initialUploadPending: boolean;
  queue: Promise<unknown>;
  pull: Promise<boolean> | null;
  push: Promise<boolean> | null;
}

const createSyncState = (userId?: string | null): SyncState => ({
  userId,
  revision: 0,
  acknowledgedRevision: 0,
  initialUploadPending: false,
  queue: Promise.resolve(),
  pull: null,
  push: null,
});

// Single-tab protection only. Pending revisions are NOT a durable outbox and
// the legacy transport still needs server-side conflict detection.
let syncState = createSyncState();
const pushScheduler = createSyncScheduler(() => { void pushUserDataToCloud(); });
const hasPendingEdits = (state: SyncState) => state.revision !== state.acknowledgedRevision;

export function setUserDataSyncAccount(userId: string | null): void {
  if (syncState.userId === userId) return;
  if (syncState.userId === undefined) {
    syncState.userId = userId;
    return;
  }
  pushScheduler.cancel();
  syncState = createSyncState(userId);
}

/** Invalidate queued work and late responses before beginning sign-out. */
export function cancelUserDataSync(): void {
  pushScheduler.cancel();
  syncState = createSyncState(null);
}

async function getSyncUser(state: SyncState): Promise<string | null> {
  if (!supabase || state !== syncState) return null;
  const { data } = await supabase.auth.getSession();
  if (state !== syncState) return null;
  const userId = data.session?.user?.id ?? null;
  if (state.userId === undefined) state.userId = userId;
  return state.userId === userId ? userId : null;
}

function enqueueSync(state: SyncState, operation: () => Promise<boolean>): Promise<boolean> {
  const result = state.queue.then(async () => {
    if (state !== syncState) return false;
    try {
      return await operation();
    } catch (err) {
      console.error('[userDataSync] Sync failed:', err);
      return false;
    }
  });
  state.queue = result;
  return result;
}

/**
 * Pull practice plan, lesson plan, logs, and completion history from Supabase for the logged in user
 */
export function pullUserDataFromCloud(): Promise<boolean> {
  const state = syncState;
  if (state.pull) return state.pull;
  state.pull = enqueueSync(state, () => pullCurrentUserData(state)).finally(() => {
    state.pull = null;
  });
  return state.pull;
}

async function pullCurrentUserData(state: SyncState): Promise<boolean> {
  if (!supabase) return false;

  try {
    const userId = await getSyncUser(state);
    if (!userId || state !== syncState || hasPendingEdits(state)) return false;
    const revision = state.revision;

    const { data, error } = await supabase
      .from('user_practice_data')
      .select('plan_data, lesson_plan_data, logs_data, completions_data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[userDataSync] Failed to pull user practice data:', error);
      return false;
    }

    // A local edit or account change during the request makes this response
    // obsolete. In particular, do not merge remote completions over local edits.
    if (await getSyncUser(state) !== userId || state !== syncState || state.revision !== revision) return false;

    if (data) {
      if (Array.isArray(data.plan_data)) {
        // Hydration is not a local edit: do not echo the entire user row back
        // to the server (including potentially stale logs or the other plan).
        savePracticePlan(data.plan_data);
      }
      if (Array.isArray(data.lesson_plan_data)) {
        saveLessonPlan(data.lesson_plan_data);
      }
      restorePracticeLogStateFromSync({
        log: data.logs_data?.overallLog,
        detailedLog: data.logs_data?.detailedLog,
        completions: data.completions_data,
      });
    } else {
      // Use the already authenticated user and bypass the public pull guard.
      // Do not report initial sync as successful when the upload failed.
      state.initialUploadPending = true;
      const uploaded = await uploadRevision(state, userId, true);
      if (!uploaded || hasPendingEdits(state)) return false;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plan-data-synced'));
    }

    return true;
  } catch (err) {
    console.error('[userDataSync] Error during pull:', err);
    return false;
  }
}

/**
 * Push practice plan, lesson plan, logs, and completion history from local storage to Supabase
 */
export function pushUserDataToCloud(): Promise<boolean> {
  const state = syncState;
  if (state.push) return state.push;
  pushScheduler.cancel();
  // Explicit requests also remain pending if the network write fails.
  if (!hasPendingEdits(state)) state.revision++;
  state.push = enqueueSync(state, async () => {
    const userId = await getSyncUser(state);
    return userId && state === syncState ? uploadRevision(state, userId, state.initialUploadPending) : false;
  }).then((success) => {
    state.push = null;
    // An acknowledgement only covers the captured revision. Edits made while
    // uploading must get another turn even if their debounce already fired.
    if (success && state === syncState && hasPendingEdits(state)) pushScheduler.schedule();
    return success;
  });
  return state.push;
}

async function uploadRevision(state: SyncState, userId: string, createOnly = false): Promise<boolean> {
  if (!hasPendingEdits(state)) state.revision++;
  const revision = state.revision;
  const uploaded = await pushCurrentUserData(userId, createOnly);
  if (await getSyncUser(state) !== userId || state !== syncState) return false;
  if (uploaded) {
    state.acknowledgedRevision = revision;
    state.initialUploadPending = false;
  }
  return uploaded;
}

/** Legacy transport retained until versioned plan rows and account isolation ship. */
async function pushCurrentUserData(userId: string, createOnly = false): Promise<boolean> {
  if (!supabase) return false;

  try {
    const planData = getPracticePlan();
    const lessonPlanData = getLessonPlan();
    const { log, detailedLog, completions } = getPracticeLogStateForSync();

    // Collision safety guard: If both plans are identical non-empty arrays,
    // abort sync to prevent clobbering cloud data with cross-contaminated state.
    if (
      planData.length > 0 &&
      lessonPlanData.length > 0 &&
      JSON.stringify(planData) === JSON.stringify(lessonPlanData)
    ) {
      console.error('[userDataSync] Aborting push: Practice plan and lesson plan are identical!');
      return false;
    }

    const payload = {
      user_id: userId,
      plan_data: planData,
      lesson_plan_data: lessonPlanData,
      logs_data: { overallLog: log, detailedLog },
      completions_data: completions,
      updated_at: new Date().toISOString(),
    };

    const table = supabase.from('user_practice_data');
    // Another device may create the row after our no-row read. Initial sync
    // must fail safely on that conflict rather than overwrite its first write.
    const { error } = createOnly
      ? await table.insert(payload)
      : await table.upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.warn('[userDataSync] Failed to push practice data:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[userDataSync] Error during push:', err);
    return false;
  }
}

/**
 * Debounce local edits, with a five-second maximum scheduling delay while
 * JavaScript is running. Browser suspension and network delivery are separate.
 */
export function scheduleUserDataPush(delayMs: number = 2000): void {
  syncState.revision++;
  pushScheduler.schedule(delayMs);
}

function syncOnReturn(): Promise<boolean> {
  // Never pull over a failed/pending local write. This retries the legacy
  // upload on reconnect/focus, not a conflict-safe multi-device merge.
  return hasPendingEdits(syncState) ? pushUserDataToCloud() : pullUserDataFromCloud();
}

let stopSyncListeners: (() => void) | null = null;

/**
 * Install one set of listeners. AuthProvider owns initial/sign-in hydration.
 */
export function initUserDataSync(): () => void {
  if (!supabase || typeof window === 'undefined' || typeof document === 'undefined') return () => { };
  if (stopSyncListeners) return stopSyncListeners;

  const { data: { subscription } } = onAuthStateChange((_event, session) => {
    // Do not call/await Supabase APIs inside its auth notification callback.
    setUserDataSyncAccount(session?.user?.id ?? null);
  });

  let lastAttempt = -Infinity;
  const handleFocus = () => {
    if (Date.now() - lastAttempt < 10000) return;
    lastAttempt = Date.now();
    void syncOnReturn();
  };
  const handleOnline = () => {
    lastAttempt = Date.now();
    void syncOnReturn();
  };
  const handlePageHide = () => {
    // Backgrounding is not itself an edit: don't upload an unchanged full row.
    if (hasPendingEdits(syncState)) void pushUserDataToCloud();
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') handleFocus();
    else if (document.visibilityState === 'hidden') handlePageHide();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('online', handleOnline);
  window.addEventListener('pagehide', handlePageHide);

  const cleanup = () => {
    if (stopSyncListeners !== cleanup) return;
    subscription.unsubscribe();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('pagehide', handlePageHide);
    pushScheduler.cancel();
    // Keep unacknowledged edits on a StrictMode remount, but invalidate old
    // requests so they cannot hydrate or acknowledge the new lifecycle.
    syncState = {
      ...createSyncState(syncState.userId),
      revision: syncState.revision,
      acknowledgedRevision: syncState.acknowledgedRevision,
      initialUploadPending: syncState.initialUploadPending,
    };
    stopSyncListeners = null;
  };
  stopSyncListeners = cleanup;
  if (hasPendingEdits(syncState)) pushScheduler.schedule();
  return cleanup;
}

if (typeof window !== 'undefined') {
  (window as any).pushUserDataToCloud = pushUserDataToCloud;
  (window as any).pullUserDataFromCloud = pullUserDataFromCloud;
}
