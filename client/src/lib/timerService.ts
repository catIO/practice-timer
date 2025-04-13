import { config } from '../../../config';

// Types for settings
export interface SettingsType {
  id?: number;
  userId?: number;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  workDuration: number;
  breakDuration: number;
  iterations: number;
  darkMode: boolean;
  numberOfBeeps: number;
  mode: string;
  volume: number;
  soundType: string;
}

// Default settings from config file
export const DEFAULT_SETTINGS: SettingsType = {
  workDuration: 25,
  breakDuration: 5,
  iterations: 4,
  soundEnabled: true,
  browserNotificationsEnabled: false,
  darkMode: true,
  numberOfBeeps: 3,
  mode: 'work',
  volume: 50,
  soundType: 'beep'
};
