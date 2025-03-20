import { create, type StateCreator } from 'zustand';

interface DarkModeStore {
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
}

export const useDarkMode = create<DarkModeStore>((set: (fn: (state: DarkModeStore) => DarkModeStore) => void) => ({
  isDark: false,
  setIsDark: (isDark: boolean) => {
    set(() => ({ isDark }));
    
    // Apply dark mode immediately
    const html = document.documentElement;
    const body = document.body;

    if (isDark) {
      html.classList.add('dark');
      body.classList.add('dark');
    } else {
      html.classList.remove('dark');
      body.classList.remove('dark');
    }
  },
})); 