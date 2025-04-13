interface Settings {
  userId: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  browserNotificationsEnabled: boolean;
  workDuration: number;
  breakDuration: number;
  iterations: number;
  darkMode: boolean;
  numberOfBeeps: number;
  id?: number;
}

interface Session {
  userId: number;
  type: 'work' | 'break';
  startTime: Date;
  endTime: Date;
  id?: number;
}

const DEFAULT_SETTINGS: Settings = {
  userId: 1,
  soundEnabled: true,
  vibrationEnabled: true,
  browserNotificationsEnabled: true,
  workDuration: 25,
  breakDuration: 5,
  iterations: 4,
  darkMode: false,
  numberOfBeeps: 3
};

class LocalStorage {
  private getItem<T>(key: string): T | null {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  }

  private setItem<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async getSettingsByUserId(userId: number): Promise<Settings | null> {
    const settings = this.getItem<Settings>(`settings-${userId}`);
    if (!settings) return DEFAULT_SETTINGS;
    
    // Ensure all settings are included
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      browserNotificationsEnabled: settings.browserNotificationsEnabled ?? true
    };
  }

  async createSettings(settings: Settings): Promise<Settings> {
    const newSettings = { 
      ...DEFAULT_SETTINGS,
      ...settings, 
      id: Date.now(),
      browserNotificationsEnabled: settings.browserNotificationsEnabled ?? true
    };
    this.setItem(`settings-${settings.userId}`, newSettings);
    return newSettings;
  }

  async updateSettings(userId: number, settings: Settings): Promise<Settings> {
    const updatedSettings = { 
      ...DEFAULT_SETTINGS,
      ...settings, 
      id: settings.id || Date.now(),
      browserNotificationsEnabled: settings.browserNotificationsEnabled ?? true
    };
    this.setItem(`settings-${userId}`, updatedSettings);
    return updatedSettings;
  }

  async getSessionsByUserId(userId: number): Promise<Session[]> {
    return this.getItem<Session[]>(`sessions-${userId}`) || [];
  }

  async createSession(session: Session): Promise<Session> {
    const sessions = await this.getSessionsByUserId(session.userId);
    const newSession = { ...session, id: Date.now() };
    sessions.push(newSession);
    this.setItem(`sessions-${session.userId}`, sessions);
    return newSession;
  }
}

export const storage = new LocalStorage(); 