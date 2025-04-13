import { SettingsType, DEFAULT_SETTINGS } from './timerService';

const SETTINGS_KEY = 'practice-timer-settings';

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