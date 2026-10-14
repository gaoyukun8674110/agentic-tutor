import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'zh' | 'en';
export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  pageGradient: string;
  overlayGradient: string;
  surface: string;
  surfaceMuted: string;
  surfaceAccent: string;
  surfaceElevated: string;
  inputSurface: string;
  hoverSurface: string;
  disabledSurface: string;
  borderSoft: string;
  borderStrong: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverted: string;
  disabledText: string;
  placeholderText: string;
  shadow: string;
  shadowSoft: string;
  accentPrimary: string;
  accentPrimarySoft: string;
  accentSecondary: string;
  accentSecondarySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  chartGrid: string;
  chartAxis: string;
  chartTooltipBg: string;
  chatUserBubble: string;
  chatUserBorder: string;
  chatUserText: string;
  chatAssistantBubble: string;
  chatAssistantBorder: string;
  chatAssistantText: string;
  sourceSurface: string;
  sourceBorder: string;
  sourceText: string;
  codeSurface: string;
  codeText: string;
  primaryActionGradient: string;
  progressGradient: string;
  brandTile: string;
  brandGlyph: string;
  brandRing: string;
  brandShadow: string;
  wallPanel: string;
  wallBorder: string;
  wallGlow: string;
  wallTitle: string;
  wallTick: string;
}

interface SettingsContextValue {
  language: Language;
  theme: ThemeMode;
  tokens: ThemeTokens;
  textStyle: { fontFamily: string; fontStyle: 'normal' | 'italic' };
  t: <T extends string>(zh: T, en: T) => T;
  toggleLanguage: () => void;
  toggleTheme: () => void;
}

const cssVar = (name: string) => `var(--ai-${name})`;

const cssThemeTokens: ThemeTokens = {
  pageGradient: cssVar('page-gradient'),
  overlayGradient: cssVar('overlay-gradient'),
  surface: cssVar('surface'),
  surfaceMuted: cssVar('surface-muted'),
  surfaceAccent: cssVar('surface-accent'),
  surfaceElevated: cssVar('surface-elevated'),
  inputSurface: cssVar('input-surface'),
  hoverSurface: cssVar('hover-surface'),
  disabledSurface: cssVar('disabled-surface'),
  borderSoft: `1px solid ${cssVar('border-soft')}`,
  borderStrong: `1px solid ${cssVar('border-strong')}`,
  borderSubtle: `1px solid ${cssVar('border-subtle')}`,
  textPrimary: cssVar('text-primary'),
  textSecondary: cssVar('text-secondary'),
  textMuted: cssVar('text-muted'),
  textInverted: cssVar('text-inverted'),
  disabledText: cssVar('disabled-text'),
  placeholderText: cssVar('placeholder-text'),
  shadow: cssVar('shadow'),
  shadowSoft: cssVar('shadow-soft'),
  accentPrimary: cssVar('accent-primary'),
  accentPrimarySoft: cssVar('accent-primary-soft'),
  accentSecondary: cssVar('accent-secondary'),
  accentSecondarySoft: cssVar('accent-secondary-soft'),
  success: cssVar('success'),
  successSoft: cssVar('success-soft'),
  warning: cssVar('warning'),
  warningSoft: cssVar('warning-soft'),
  danger: cssVar('danger'),
  dangerSoft: cssVar('danger-soft'),
  info: cssVar('info'),
  infoSoft: cssVar('info-soft'),
  chartGrid: cssVar('chart-grid'),
  chartAxis: cssVar('chart-axis'),
  chartTooltipBg: cssVar('chart-tooltip-bg'),
  chatUserBubble: cssVar('chat-user-bubble'),
  chatUserBorder: `1px solid ${cssVar('chat-user-border')}`,
  chatUserText: cssVar('chat-user-text'),
  chatAssistantBubble: cssVar('chat-assistant-bubble'),
  chatAssistantBorder: `1px solid ${cssVar('chat-assistant-border')}`,
  chatAssistantText: cssVar('chat-assistant-text'),
  sourceSurface: cssVar('source-surface'),
  sourceBorder: `1px solid ${cssVar('source-border')}`,
  sourceText: cssVar('source-text'),
  codeSurface: cssVar('code-surface'),
  codeText: cssVar('code-text'),
  primaryActionGradient: cssVar('primary-action-gradient'),
  progressGradient: cssVar('progress-gradient'),
  brandTile: cssVar('brand-tile'),
  brandGlyph: cssVar('brand-glyph'),
  brandRing: cssVar('brand-ring'),
  brandShadow: cssVar('brand-shadow'),
  wallPanel: cssVar('wall-panel'),
  wallBorder: cssVar('wall-border'),
  wallGlow: cssVar('wall-glow'),
  wallTitle: cssVar('wall-title'),
  wallTick: cssVar('wall-tick'),
};

const themeTokens: Record<ThemeMode, ThemeTokens> = {
  light: cssThemeTokens,
  dark: cssThemeTokens,
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'zh';
  return window.localStorage.getItem('ai-tutor-language') === 'en' ? 'en' : 'zh';
}

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.localStorage.getItem('ai-tutor-theme') === 'light' ? 'light' : 'dark';
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage());
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem('ai-tutor-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.body.dataset.lang = language;
    window.localStorage.setItem('ai-tutor-language', language);
  }, [language]);

  const textStyle = useMemo(
    () =>
      language === 'zh'
        ? {
            fontFamily: "'Inter', 'Noto Sans SC', 'Segoe UI', sans-serif",
            fontStyle: 'normal' as const,
          }
        : {
            fontFamily: "'Inter', 'Noto Sans SC', 'Segoe UI', sans-serif",
            fontStyle: 'normal' as const,
          },
    [language],
  );

  const value = useMemo(
    () => ({
      language,
      theme,
      tokens: themeTokens[theme],
      textStyle,
      t: <T extends string>(zh: T, en: T) => (language === 'zh' ? zh : en),
      toggleLanguage: () => setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh')),
      toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),
    }),
    [language, theme, textStyle],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
