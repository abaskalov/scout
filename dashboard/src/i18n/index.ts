import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import ruMessages from './ru.json';
import enMessages from './en.json';
import uzMessages from './uz.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Locale = 'ru' | 'en' | 'uz';

type Messages = Record<string, string>;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'scout_locale';

const LOCALES: Locale[] = ['ru', 'en', 'uz'];

export const LOCALE_MAP: Record<Locale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-Latn',
};

export const LOCALE_LABELS: Record<Locale, string> = {
  ru: 'Русский',
  en: 'English',
  uz: "O'zbekcha",
};

const messages: Record<Locale, Messages> = {
  ru: ruMessages,
  en: enMessages,
  uz: uzMessages,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.includes(value as Locale);
}

function detectLocale(): Locale {
  // 1. localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;

  // 2. navigator.language first 2 chars
  const nav = navigator.language?.slice(0, 2);
  if (isLocale(nav)) return nav;

  // 3. fallback
  return 'ru';
}

function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? `{${key}}`);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const I18nContext = createContext<I18nContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  useEffect(() => {
    document.documentElement.lang = LOCALE_MAP[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>): string => {
      const msg = messages[locale][key];
      if (msg === undefined) {
        // Dev-time warning for missing keys
        if (import.meta.env.DEV) {
          console.warn(`[i18n] Missing key "${key}" for locale "${locale}"`);
        }
        return key;
      }
      return params ? interpolate(msg, params) : msg;
    },
    [locale],
  );

  const value: I18nContextValue = { locale, setLocale, t };

  return createElement(I18nContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within <I18nProvider>');
  }
  return ctx;
}
