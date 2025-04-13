// Pomodoro Timer Configuration
export const config = {
  // Default settings
  defaultSettings: {
    soundEnabled: true,
    vibrationEnabled: true,
    browserNotificationsEnabled: true,
    workDuration: 25, // minutes
    breakDuration: 5,  // minutes
    iterations: 4,     // number of work-break cycles
    darkMode: true,    // dark mode setting
    numberOfBeeps: 3   // number of beeps when timer completes
  },
  
  // App configuration
  app: {
    name: "Practice Timer",
    version: "1.0.0",
    saveSettingsToLocalStorage: true,
    saveSessionsToLocalStorage: true
  }
};