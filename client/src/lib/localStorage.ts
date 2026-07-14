import { SettingsType, DEFAULT_SETTINGS } from './timerService';

const SETTINGS_KEY = 'practice-timer-settings';
const TIMER_PROGRESS_KEY = 'practice-timer-progress';

export interface TimerProgress {
  timeRemaining: number;
  totalTime: number;
  mode: 'work' | 'break';
  currentIteration: number;
  totalIterations: number;
  isPracticeComplete: boolean;
  // isRunning is intentionally omitted — we always restore as paused
}

export function getTimerProgress(): TimerProgress | null {
  try {
    const stored = localStorage.getItem(TIMER_PROGRESS_KEY);
    if (stored) {
      return JSON.parse(stored) as TimerProgress;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTimerProgress(progress: TimerProgress): void {
  try {
    localStorage.setItem(TIMER_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage errors
  }
}

export function clearTimerProgress(): void {
  try {
    localStorage.removeItem(TIMER_PROGRESS_KEY);
  } catch {
    // Ignore
  }
}

export function getSettings(): SettingsType {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (storedSettings) {
      const parsedSettings = JSON.parse(storedSettings);
      // Ensure all required fields are present
      return {
        ...DEFAULT_SETTINGS,
        ...parsedSettings,
      };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: SettingsType): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
} 