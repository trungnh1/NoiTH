export interface AppSettings {
  fontSize: 'small' | 'normal' | 'large' | 'xlarge';
  themeMode: 'light' | 'dark';
  colorTheme: 'rose' | 'indigo' | 'emerald' | 'slate';
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 'normal',
  themeMode: 'light',
  colorTheme: 'rose',
};

const SETTINGS_KEY = 'BV_HUNG_VUONG_APP_SETTINGS';

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to load app settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save app settings:', e);
  }
}

/**
 * Get CSS root font size or scale class
 */
export function getFontSizeScale(fontSize: AppSettings['fontSize']): string {
  switch (fontSize) {
    case 'small':
      return 'text-[92%]';
    case 'large':
      return 'text-[108%]';
    case 'xlarge':
      return 'text-[116%]';
    case 'normal':
    default:
      return 'text-[100%]';
  }
}
