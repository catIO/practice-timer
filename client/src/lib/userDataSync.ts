import { supabase } from './supabaseClient';
import { getPracticePlan, savePracticePlan } from './practicePlan';
import { getLessonPlan, saveLessonPlan } from './lessonPlan';
import {
  getPracticeLogStateForSync,
  restorePracticeLogStateFromSync,
} from './practiceLog';
import { onAuthStateChange } from './authService';
import { createSyncScheduler } from './syncScheduler';

let isSyncing = false;
const pushScheduler = createSyncScheduler(() => { void pushUserDataToCloud(); });

/**
 * Pull practice plan, lesson plan, logs, and completion history from Supabase for the logged in user
 */
export async function pullUserDataFromCloud(): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return false;

    isSyncing = true;
    const { data, error } = await supabase
      .from('user_practice_data')
      .select('plan_data, lesson_plan_data, logs_data, completions_data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[userDataSync] Failed to pull user practice data:', error);
      isSyncing = false;
      return false;
    }

    if (data) {
      if (data.plan_data && Array.isArray(data.plan_data) && data.plan_data.length > 0) {
        // Hydration is not a local edit: do not echo the entire user row back
        // to the server (including potentially stale logs or the other plan).
        savePracticePlan(data.plan_data);
      }
      if (data.lesson_plan_data && Array.isArray(data.lesson_plan_data) && data.lesson_plan_data.length > 0) {
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
      const uploaded = await pushCurrentUserData(userId, true);
      if (!uploaded) {
        isSyncing = false;
        return false;
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('plan-data-synced'));
    }

    isSyncing = false;
    return true;
  } catch (err) {
    console.error('[userDataSync] Error during pull:', err);
    isSyncing = false;
    return false;
  }
}

/**
 * Push practice plan, lesson plan, logs, and completion history from local storage to Supabase
 */
export async function pushUserDataToCloud(): Promise<boolean> {
  if (!supabase || isSyncing) return false;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return false;

    return await pushCurrentUserData(userId);
  } catch (err) {
    console.error('[userDataSync] Error during push:', err);
    return false;
  }
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
  pushScheduler.schedule(delayMs);
}

let lastPullTime = 0;

/**
 * Initialize sync listener for auth changes, tab focus, and page backgrounding
 */
export function initUserDataSync(): void {
  if (!supabase) return;

  onAuthStateChange((event, session) => {
    if (session?.user) {
      pullUserDataFromCloud();
    }
  });

  // Initial pull if session exists
  pullUserDataFromCloud();

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        // Automatically pull fresh data from cloud if at least 10s since last pull
        if (now - lastPullTime > 10000) {
          lastPullTime = now;
          pullUserDataFromCloud();
        }
      } else if (document.visibilityState === 'hidden') {
        // App backgrounded on iPad or tab switched - flush pending push immediately
        scheduleUserDataPush(0);
      }
    };

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastPullTime > 10000) {
        lastPullTime = now;
        pullUserDataFromCloud();
      }
    };

    const handlePageHide = () => {
      scheduleUserDataPush(0);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
  }
}

if (typeof window !== 'undefined') {
  (window as any).pushUserDataToCloud = pushUserDataToCloud;
  (window as any).pullUserDataFromCloud = pullUserDataFromCloud;
}
