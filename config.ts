// Pomodoro Timer Configuration
export const config = {
  // Default settings
  defaultSettings: {
    soundEnabled: true,
    vibrationEnabled: true,
    workDuration: 25, // minutes
    breakDuration: 5,  // minutes
    iterations: 4,     // number of work-break cycles
    darkMode: false    // dark mode setting
  },
  
  // App configuration
  app: {
    name: "Practice Timer",
    version: "1.0.0",
    saveSettingsToLocalStorage: true,
    saveSessionsToLocalStorage: true
  }
};