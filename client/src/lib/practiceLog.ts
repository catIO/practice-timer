/**
 * Practice log - tracks total practice time per day
 * Stored in localStorage: { [date: string]: number } where date is YYYY-MM-DD, value is seconds
 */
import { PracticePlanItem } from './practicePlan';

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
  weekStartsOn: WeekStartsOn = 'monday',
  limitDays?: number
): WeekGroup[] {
  let dailyLogs = getDailyBreakdown();

  if (limitDays && limitDays > 0) {
    dailyLogs = dailyLogs.slice(0, limitDays);
  }

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

const DETAILED_LOG_KEY = 'practice-timer-detailed-log';

export interface DetailedLogEntry {
  itemId: string;
  itemName: string;
  seconds: number;
}

export type DetailedPracticeLog = Record<string, Record<string, DetailedLogEntry>>;

export function getDetailedPracticeLog(): DetailedPracticeLog {
  try {
    const stored = localStorage.getItem(DETAILED_LOG_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveDetailedPracticeLog(log: DetailedPracticeLog): void {
  try {
    localStorage.setItem(DETAILED_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error('Failed to save detailed log:', e);
  }
}

export function addDetailedPracticeTime(itemId: string, itemName: string, seconds: number): void {
  const date = getLocalYMD();

  // 1. Log overall time
  addPracticeTime(seconds);

  // 2. Log detailed time
  const log = getDetailedPracticeLog();
  if (!log[date]) {
    log[date] = {};
  }
  if (!log[date][itemId]) {
    log[date][itemId] = { itemId, itemName, seconds: 0 };
  }
  log[date][itemId].seconds += seconds;
  log[date][itemId].itemName = itemName; // Keep name in sync
  saveDetailedPracticeLog(log);
}

export interface PieceTimeSummary {
  itemId: string;
  itemName: string;
  seconds: number;
  allocatedTime?: number;
  allocationPeriod?: 'day' | 'week';
}

function flattenPlan(items: PracticePlanItem[]): PracticePlanItem[] {
  let result: PracticePlanItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children && item.children.length > 0) {
      result = result.concat(flattenPlan(item.children));
    }
  }
  return result;
}

export function getPieceTimeForRange(
  startDateStr: string,
  endDateStr: string,
  planItems: PracticePlanItem[]
): PieceTimeSummary[] {
  const log = getDetailedPracticeLog();
  const summaryMap: Record<string, { itemName: string; seconds: number }> = {};

  // Parse ranges
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T23:59:59');

  // Gather actual seconds from logs
  for (const [dateStr, pieces] of Object.entries(log)) {
    const d = new Date(dateStr + 'T12:00:00');
    if (d >= start && d <= end) {
      for (const [itemId, entry] of Object.entries(pieces)) {
        if (!summaryMap[itemId]) {
          summaryMap[itemId] = { itemName: entry.itemName, seconds: 0 };
        }
        summaryMap[itemId].seconds += entry.seconds;
      }
    }
  }

  const flatItems = flattenPlan(planItems);
  const result: PieceTimeSummary[] = [];

  // Add entries that were practiced
  for (const [itemId, summary] of Object.entries(summaryMap)) {
    const planItem = flatItems.find(item => item.id === itemId);
    result.push({
      itemId,
      itemName: planItem?.text || summary.itemName,
      seconds: summary.seconds,
      allocatedTime: planItem?.allocatedTime,
      allocationPeriod: planItem?.allocationPeriod
    });
  }

  // Include items that have allocations but weren't practiced
  for (const planItem of flatItems) {
    if (planItem.allocatedTime !== undefined && !summaryMap[planItem.id]) {
      if (
        planItem.blockType !== 'heading1' &&
        planItem.blockType !== 'heading2' &&
        planItem.blockType !== 'heading3' &&
        planItem.blockType !== 'divider'
      ) {
        result.push({
          itemId: planItem.id,
          itemName: planItem.text,
          seconds: 0,
          allocatedTime: planItem.allocatedTime,
          allocationPeriod: planItem.allocationPeriod
        });
      }
    }
  }

  return result;
}

export function getThisWeekRange(weekStartsOn: WeekStartsOn = 'monday'): { start: string; end: string } {
  const start = getWeekStart(getLocalYMD(), weekStartsOn);
  const startD = new Date(start + 'T12:00:00');
  const endD = new Date(startD);
  endD.setDate(startD.getDate() + 6);
  return { start, end: getLocalYMD(endD) };
}

export function getLastWeekRange(weekStartsOn: WeekStartsOn = 'monday'): { start: string; end: string } {
  const thisWeekStart = getWeekStart(getLocalYMD(), weekStartsOn);
  const thisWeekStartD = new Date(thisWeekStart + 'T12:00:00');
  const startD = new Date(thisWeekStartD);
  startD.setDate(startD.getDate() - 7);
  const endD = new Date(startD);
  endD.setDate(startD.getDate() + 6);
  return { start: getLocalYMD(startD), end: getLocalYMD(endD) };
}

export function getPiecePracticedSeconds(
  itemId: string,
  period: 'day' | 'week',
  weekStartsOn: WeekStartsOn = 'monday'
): number {
  const log = getDetailedPracticeLog();
  let totalSeconds = 0;

  if (period === 'day') {
    const today = getLocalYMD();
    return log[today]?.[itemId]?.seconds ?? 0;
  } else {
    const { start, end } = getThisWeekRange(weekStartsOn);
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');

    for (const [dateStr, pieces] of Object.entries(log)) {
      const d = new Date(dateStr + 'T12:00:00');
      if (d >= startDate && d <= endDate) {
        totalSeconds += pieces[itemId]?.seconds ?? 0;
      }
    }
  }

  return totalSeconds;
}

export interface Last7DaysSummary {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalSeconds: number;
  pieces: Array<{ itemId: string; itemName: string; seconds: number; completionsCount?: number }>;
}

export function getReportSummaryForRange(
  startDate: string,
  endDate: string,
  planItems: PracticePlanItem[]
): Last7DaysSummary {
  const pieceMap: Record<string, { itemName: string; seconds: number }> = {};
  const log = getDetailedPracticeLog();
  const overallLog = getPracticeLog();

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  let totalSeconds = 0;
  for (const [dateStr, secs] of Object.entries(overallLog)) {
    const d = new Date(dateStr + 'T12:00:00');
    if (d >= start && d <= end) totalSeconds += secs;
  }

  for (const [dateStr, pieces] of Object.entries(log)) {
    const d = new Date(dateStr + 'T12:00:00');
    if (d >= start && d <= end) {
      for (const [itemId, entry] of Object.entries(pieces)) {
        if (!pieceMap[itemId]) pieceMap[itemId] = { itemName: entry.itemName, seconds: 0 };
        pieceMap[itemId].seconds += entry.seconds;
      }
    }
  }

  const detailedTotalSeconds = Object.values(pieceMap).reduce((sum, item) => sum + item.seconds, 0);
  if (detailedTotalSeconds > totalSeconds) {
    totalSeconds = detailedTotalSeconds;
  }

  const completions = getSegmentCompletions();
  const startMs = start.getTime();
  const endMs = end.getTime();

  const pieces = Object.entries(pieceMap)
    .map(([itemId, { itemName, seconds }]) => {
      const rawTimestamps = completions[itemId] || [];
      const itemTimestamps = deduplicateTimestamps(rawTimestamps);
      const completionsCount = itemTimestamps.filter((ts) => ts >= startMs && ts <= endMs).length;
      return {
        itemId,
        itemName,
        seconds,
        completionsCount,
      };
    })
    .sort((a, b) => b.seconds - a.seconds);

  return { startDate, endDate, totalSeconds, pieces };
}

export function getThisWeekSummary(
  planItems: PracticePlanItem[],
  weekStartsOn: WeekStartsOn = 'monday'
): Last7DaysSummary {
  const { start, end } = getThisWeekRange(weekStartsOn);
  return getReportSummaryForRange(start, end, planItems);
}

export function getLastWeekSummary(
  planItems: PracticePlanItem[],
  weekStartsOn: WeekStartsOn = 'monday'
): Last7DaysSummary {
  const { start, end } = getLastWeekRange(weekStartsOn);
  return getReportSummaryForRange(start, end, planItems);
}

export function getLast7DaysSummary(planItems: PracticePlanItem[]): Last7DaysSummary {
  const endDate = getLocalYMD();
  const endD = new Date(endDate + 'T12:00:00');
  const startD = new Date(endD);
  startD.setDate(startD.getDate() - 6);
  const startDate = getLocalYMD(startD);
  return getReportSummaryForRange(startDate, endDate, planItems);
}

const PRACTICE_COMPLETIONS_KEY = 'practice-timer-completions';

export type SegmentCompletionLog = Record<string, number[]>;

export function saveSegmentCompletions(log: SegmentCompletionLog): void {
  try {
    localStorage.setItem(PRACTICE_COMPLETIONS_KEY, JSON.stringify(log));
  } catch (e) {
    console.error('Failed to save segment completions:', e);
  }
}

function deduplicateTimestamps(timestamps: number[]): number[] {
  if (!timestamps || timestamps.length === 0) return [];
  const sorted = [...timestamps].sort((a, b) => a - b);
  const result: number[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - result[result.length - 1] >= 15000) {
      result.push(sorted[i]);
    }
  }
  return result;
}

export function getSegmentCompletions(): SegmentCompletionLog {
  try {
    const stored = localStorage.getItem(PRACTICE_COMPLETIONS_KEY);
    if (!stored) return {};
    const parsed: SegmentCompletionLog = JSON.parse(stored);
    let needsSave = false;
    const cleaned: SegmentCompletionLog = {};
    for (const [id, timestamps] of Object.entries(parsed)) {
      if (Array.isArray(timestamps)) {
        const deduped = deduplicateTimestamps(timestamps);
        cleaned[id] = deduped;
        if (deduped.length !== timestamps.length) {
          needsSave = true;
        }
      }
    }
    if (needsSave) {
      try {
        localStorage.setItem(PRACTICE_COMPLETIONS_KEY, JSON.stringify(cleaned));
      } catch (e) {
        console.error('Failed to clean stored completion timestamps:', e);
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

export function logSegmentCompletion(itemId: string, timestamp: number = Date.now()): void {
  if (!itemId) return;
  const completions = getSegmentCompletions();
  if (!completions[itemId]) {
    completions[itemId] = [];
  }
  const lastTs = completions[itemId][completions[itemId].length - 1];
  if (lastTs && Math.abs(timestamp - lastTs) < 15000) {
    return;
  }
  completions[itemId].push(timestamp);
  saveSegmentCompletions(completions);
}

export function getSegmentCompletionsForThisWeek(
  itemId: string,
  weekStartsOn: WeekStartsOn = 'monday',
  now: number = Date.now()
): number {
  const completions = getSegmentCompletions();
  const rawTimestamps = completions[itemId] || [];
  const itemTimestamps = deduplicateTimestamps(rawTimestamps);

  const dateObj = new Date(now);
  const dateStr = getLocalYMD(dateObj);
  const weekStart = getWeekStart(dateStr, weekStartsOn);
  const startMs = new Date(weekStart + 'T00:00:00').getTime();
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;

  const explicitCount = itemTimestamps.filter((ts) => ts >= startMs && ts < endMs).length;
  if (explicitCount > 0) return explicitCount;

  // Fallback for legacy practice logs (e.g. items practiced earlier today before migration):
  // Count unique days in current week where detailed practice time was logged for this item.
  const detailedLog = getDetailedPracticeLog();
  let legacyCount = 0;
  const startD = new Date(weekStart + 'T00:00:00');
  const endD = new Date(startD);
  endD.setDate(startD.getDate() + 6);
  endD.setHours(23, 59, 59, 999);

  for (const [dStr, pieces] of Object.entries(detailedLog)) {
    const d = new Date(dStr + 'T12:00:00');
    if (d >= startD && d <= endD && (pieces[itemId]?.seconds ?? 0) > 0) {
      legacyCount++;
    }
  }

  return legacyCount;
}

export function getSegmentCompletionsLast7Days(
  itemId: string,
  now: number = Date.now()
): number {
  const completions = getSegmentCompletions();
  const rawTimestamps = completions[itemId] || [];
  const itemTimestamps = deduplicateTimestamps(rawTimestamps);

  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  return itemTimestamps.filter((ts) => ts >= sevenDaysAgo && ts <= now).length;
}

export function getAllSegmentCompletionsForThisWeek(
  weekStartsOn: WeekStartsOn = 'monday',
  now: number = Date.now()
): Record<string, number> {
  const completions = getSegmentCompletions();
  const result: Record<string, number> = {};
  for (const itemId of Object.keys(completions)) {
    result[itemId] = getSegmentCompletionsForThisWeek(itemId, weekStartsOn, now);
  }
  return result;
}

export function getPracticeLogStateForSync(): {
  log: Record<string, number>;
  detailedLog: DetailedPracticeLog;
  completions: SegmentCompletionLog;
} {
  return {
    log: getPracticeLog(),
    detailedLog: getDetailedPracticeLog(),
    completions: getSegmentCompletions(),
  };
}

export function restorePracticeLogStateFromSync(data: {
  log?: Record<string, number>;
  detailedLog?: DetailedPracticeLog;
  completions?: SegmentCompletionLog;
}): void {
  if (data.log) {
    try {
      localStorage.setItem(PRACTICE_LOG_KEY, JSON.stringify(data.log));
    } catch (e) {
      console.error('Failed to restore practice log:', e);
    }
  }
  if (data.detailedLog) {
    saveDetailedPracticeLog(data.detailedLog);
  }
  if (data.completions) {
    saveSegmentCompletions(data.completions);
  }
}


