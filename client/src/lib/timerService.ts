import { config } from '../../../config';

// Types for settings
export interface SettingsType {
  id?: number;
  userId?: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  workDuration: number;
  breakDuration: number;
  iterations: number;
  darkMode: boolean;
}

// Default settings from config file
export const DEFAULT_SETTINGS: SettingsType = config.defaultSettings;
