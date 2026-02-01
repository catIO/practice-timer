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
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceWeekStart =
    weekStartsOn === 'monday' ? (day + 6) % 7 : day;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - daysSinceWeekStart);
  return weekStart.toISOString().slice(0, 10);
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
    .sort(([a], [b]) => b.localeCompare(a))
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
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === today.toISOString().slice(0, 10)) return 'Today';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
