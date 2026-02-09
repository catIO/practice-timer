/**
 * Practice log - tracks total practice time per day
 * Stored in localStorage: { [date: string]: number } where date is YYYY-MM-DD, value is seconds
 */

const PRACTICE_LOG_KEY = 'practice-timer-log';

export type WeekStartsOn = 'monday' | 'sunday';

export interface DailyLog {
  date: string; // YYYY-MM-DD
  seconds: number;
}

export interface WeekGroup {
  weekStart: string; // YYYY-MM-DD of the week's start day
  weekLabel: string; // e.g. "Week of Mon Jan 6"
  days: DailyLog[];
}

/**
 * Helper to get local date string YYYY-MM-DD
 * This avoids the UTC shift from toISOString()
 */
function getLocalYMD(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPracticeLog(): Record<string, number> {
  try {
    const stored = localStorage.getItem(PRACTICE_LOG_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return {};
  } catch {
    return {};
  }
}

export function addPracticeTime(seconds: number): void {
  const date = getLocalYMD(); // Use local date
  const log = getPracticeLog();
  log[date] = (log[date] ?? 0) + seconds;
  try {
    localStorage.setItem(PRACTICE_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error('Failed to save practice log:', e);
  }
}

export function getDailyBreakdown(): DailyLog[] {
  const log = getPracticeLog();
  return Object.entries(log)
    .map(([date, seconds]) => ({ date, seconds }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Get the week start date (YYYY-MM-DD) for a given date based on weekStartsOn */
function getWeekStart(dateStr: string, weekStartsOn: WeekStartsOn): string {
  // Parse as local noon to avoid midnight offsets
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceWeekStart =
    weekStartsOn === 'monday' ? (day + 6) % 7 : day;

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - daysSinceWeekStart);

  // Return local YMD, not UTC
  return getLocalYMD(weekStart);
}

/** Format week start date for display, e.g. "Week of Mon Jan 6" */
function formatWeekLabel(weekStartStr: string): string {
  const d = new Date(weekStartStr + 'T12:00:00');
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
  const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Week of ${weekday} ${monthDay}`;
}

export function getDailyBreakdownByWeek(
  weekStartsOn: WeekStartsOn = 'monday'
): WeekGroup[] {
  const dailyLogs = getDailyBreakdown();
  const weekMap = new Map<string, DailyLog[]>();

  for (const log of dailyLogs) {
    const weekStart = getWeekStart(log.date, weekStartsOn);
    const existing = weekMap.get(weekStart) ?? [];
    existing.push(log);
    weekMap.set(weekStart, existing);
  }

  return Array.from(weekMap.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // Sort weeks descending
    .map(([weekStart, days]) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      days,
    }));
}

export function getTotalSeconds(): number {
  const log = getPracticeLog();
  return Object.values(log).reduce((sum, s) => sum + s, 0);
}

/** Get practice time for today (YYYY-MM-DD) in seconds */
export function getTodaySeconds(): number {
  const today = getLocalYMD(); // Local
  const log = getPracticeLog();
  return log[today] ?? 0;
}

/** Get practice time for the current week in seconds (week boundaries from weekStartsOn) */
export function getThisWeekSeconds(weekStartsOn: WeekStartsOn = 'monday'): number {
  const today = getLocalYMD(); // Local
  const currentWeekStart = getWeekStart(today, weekStartsOn);
  const log = getPracticeLog();
  return Object.entries(log).reduce((sum, [date, seconds]) => {
    if (getWeekStart(date, weekStartsOn) === currentWeekStart) {
      return sum + seconds;
    }
    return sum;
  }, 0);
}

/** Get practice time for the week before the current week in seconds */
export function getLastWeekSeconds(weekStartsOn: WeekStartsOn = 'monday'): number {
  const today = getLocalYMD();
  const currentWeekStart = getWeekStart(today, weekStartsOn);
  const currentStart = new Date(currentWeekStart + 'T12:00:00');
  const lastWeekStart = new Date(currentStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStartStr = getLocalYMD(lastWeekStart);
  const log = getPracticeLog();
  return Object.entries(log).reduce((sum, [date, seconds]) => {
    if (getWeekStart(date, weekStartsOn) === lastWeekStartStr) {
      return sum + seconds;
    }
    return sum;
  }, 0);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m} min`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();

  // To verify "Today" vs "Yesterday", we must generate local strings for comparison
  // because "d" is a generic date object.
  const todayStr = getLocalYMD(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalYMD(yesterday);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
