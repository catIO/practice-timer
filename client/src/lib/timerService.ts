import { config } from '../../../config';

// Types for settings
export type WeekStartsOn = 'monday' | 'sunday';

export interface SettingsType {
  id?: number;
  userId?: number;
  soundEnabled: boolean;
  browserNotificationsEnabled: boolean;
  workDuration: number;
  breakDuration: number;
  iterations: number;
  numberOfBeeps: number;
  mode: string;
  volume: number;
  soundType: string;
  weekStartsOn: WeekStartsOn;
}

// Default settings from config file
export const DEFAULT_SETTINGS: SettingsType = {
  workDuration: 20,
  breakDuration: 5,
  iterations: 6,
  soundEnabled: true,
  browserNotificationsEnabled: false,
  numberOfBeeps: 3,
  mode: 'work',
  volume: 50,
  soundType: 'beep',
  weekStartsOn: 'monday'
};
