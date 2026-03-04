// App settings management

export interface SupabaseSettings {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export interface AppSettings {
  supabase: SupabaseSettings;
  theme?: 'light' | 'dark' | 'system';
  updatedAt?: Date;
}

const SETTINGS_KEY = 'analytique-settings';

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') {
    return getDefaultSettings();
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...getDefaultSettings(),
        ...parsed,
        updatedAt: parsed.updatedAt ? new Date(parsed.updatedAt) : undefined,
      };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  return getDefaultSettings();
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...settings,
        updatedAt: new Date(),
      })
    );
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function getDefaultSettings(): AppSettings {
  return {
    supabase: {
      url: '',
      anonKey: '',
      serviceKey: '',
    },
    theme: 'system',
  };
}

export function isSupabaseConfigured(settings: AppSettings): boolean {
  return !!(
    settings.supabase.url &&
    settings.supabase.anonKey &&
    settings.supabase.serviceKey
  );
}

export function validateSupabaseUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.includes('supabase');
  } catch {
    return false;
  }
}

export function validateSupabaseKey(key: string): boolean {
  return key.length > 20;
}
