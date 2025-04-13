import { create } from 'zustand';

interface DarkModeStore {
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
}

export const useDarkMode = create<DarkModeStore>((set) => ({
  isDark: true,
  setIsDark: (isDark: boolean) => set({ isDark }),
})); 