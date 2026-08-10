import { supabase } from './supabaseClient';
import { getPracticePlan, practicePlanApi } from './practicePlan';
import {
  getPracticeLogStateForSync,
  restorePracticeLogStateFromSync,
} from './practiceLog';
import { onAuthStateChange } from './authService';

let pushTimeout: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

/**
 * Pull practice plan, logs, and completion history from Supabase for the logged in user
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
      .select('plan_data, logs_data, completions_data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[userDataSync] Failed to pull user practice data:', error);
      isSyncing = false;
      return false;
    }

    if (data) {
      if (data.plan_data && Array.isArray(data.plan_data) && data.plan_data.length > 0) {
        practicePlanApi.save(data.plan_data);
      }
      restorePracticeLogStateFromSync({
        log: data.logs_data?.overallLog,
        detailedLog: data.logs_data?.detailedLog,
        completions: data.completions_data,
      });
    } else {
      // First sync for this user — push current local data to cloud
      await pushUserDataToCloud();
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
 * Push practice plan, logs, and completion history from local storage to Supabase
 */
export async function pushUserDataToCloud(): Promise<boolean> {
  if (!supabase || isSyncing) return false;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return false;

    const planData = getPracticePlan();
    const { log, detailedLog, completions } = getPracticeLogStateForSync();

    const payload = {
      user_id: userId,
      plan_data: planData,
      logs_data: { overallLog: log, detailedLog },
      completions_data: completions,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_practice_data')
      .upsert(payload, { onConflict: 'user_id' });

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
 * Schedule a debounced push of local user practice data to Supabase
 */
export function scheduleUserDataPush(delayMs: number = 2000): void {
  if (pushTimeout) {
    clearTimeout(pushTimeout);
  }
  pushTimeout = setTimeout(() => {
    pushUserDataToCloud();
  }, delayMs);
}

/**
 * Initialize sync listener for auth changes
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
}
