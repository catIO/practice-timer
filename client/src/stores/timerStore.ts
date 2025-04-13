import { create } from 'zustand';
import { SettingsType } from '@/lib/timerService';
import { getSettings } from '@/lib/localStorage';

interface TimerState {
  timeRemaining: number;
  totalTime: number;
  isRunning: boolean;
  mode: 'work' | 'break';
  currentIteration: number;
  totalIterations: number;
  settings: SettingsType;
  setTimeRemaining: (time: number) => void;
  setTotalTime: (time: number) => void;
  setIsRunning: (isRunning: boolean) => void;
  setMode: (mode: 'work' | 'break') => void;
  setCurrentIteration: (iteration: number) => void;
  setTotalIterations: (iterations: number) => void;
  setSettings: (settings: SettingsType) => void;
}

// Get saved settings or use defaults
const savedSettings = getSettings();
const DEFAULT_WORK_TIME = savedSettings.workDuration * 60; // Convert minutes to seconds

export const useTimerStore = create<TimerState>((set) => ({
  timeRemaining: DEFAULT_WORK_TIME,
  totalTime: DEFAULT_WORK_TIME,
  isRunning: false,
  mode: 'work',
  currentIteration: 1,
  totalIterations: savedSettings.iterations,
  settings: savedSettings,
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  setTotalTime: (time) => set({ totalTime: time }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setMode: (mode) => set({ mode }),
  setCurrentIteration: (iteration) => set({ currentIteration: iteration }),
  setTotalIterations: (iterations) => set({ totalIterations: iterations }),
  setSettings: (settings) => set({ settings }),
})); 