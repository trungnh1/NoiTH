export interface AppSettings {
  // Typography
  fontSize: 'compact' | 'small' | 'normal' | 'large' | 'xlarge';
  fontFamily: 'plus-jakarta' | 'inter' | 'roboto' | 'mono' | 'serif';
  
  // Theme & Appearance
  themeMode: 'light' | 'dark' | 'eye-care';
  colorTheme: 'blue' | 'rose' | 'emerald' | 'indigo' | 'slate';
  
  // Density & Clinical Layout
  tableDensity: 'compact' | 'normal' | 'spacious';
  showVitalSigns: boolean;
  showClinicalEvolution: boolean;
  showTreatmentPlan: boolean;
  showHandoverNotes: boolean;
  showIcd10Code: boolean;
  showNewPatientBadge: boolean;
  showAllergyHighlight: boolean;
  
  // System & Printing
  enableAlertSound: boolean;
  autoRefreshInterval: number; // in seconds (0 = off, 60, 120, 300)
  defaultPrintOrientation: 'portrait' | 'landscape';
  defaultPrintLayout: 'table' | 'cards';
}

export const FONT_FAMILY_MAP: Record<AppSettings['fontFamily'], string> = {
  'plus-jakarta': "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  'inter': "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
  'roboto': "'Roboto', 'Segoe UI', Arial, sans-serif",
  'mono': "'JetBrains Mono', 'Courier New', monospace",
  'serif': "Georgia, Cambria, 'Times New Roman', serif",
};

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 'normal',
  fontFamily: 'plus-jakarta',
  themeMode: 'light',
  colorTheme: 'blue',
  tableDensity: 'compact',
  showVitalSigns: true,
  showClinicalEvolution: true,
  showTreatmentPlan: true,
  showHandoverNotes: true,
  showIcd10Code: true,
  showNewPatientBadge: true,
  showAllergyHighlight: true,
  enableAlertSound: true,
  autoRefreshInterval: 0,
  defaultPrintOrientation: 'landscape',
  defaultPrintLayout: 'table',
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
 * Get CSS root font size scale class
 */
export function getFontSizeScale(fontSize: AppSettings['fontSize']): string {
  switch (fontSize) {
    case 'compact':
      return 'text-[92%]';
    case 'small':
      return 'text-[96%]';
    case 'large':
      return 'text-[116%]';
    case 'xlarge':
      return 'text-[128%]';
    case 'normal':
    default:
      return 'text-[104%]';
  }
}
