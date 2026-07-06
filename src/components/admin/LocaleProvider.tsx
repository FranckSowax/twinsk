'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DICT, type Locale, type TKey } from '@/lib/i18n/admin';

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: TKey) => string;
}

const Ctx = createContext<LocaleCtx | null>(null);
const STORAGE_KEY = 'twinsk_admin_locale';

export function AdminLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'zh' || saved === 'fr') setLocaleState(saved);
    } catch {
      // ignore
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  };

  const t = (k: TKey): string => DICT[locale][k] ?? DICT.fr[k] ?? k;

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

/** Hook de traduction admin. Fallback FR si hors provider. */
export function useAdminT(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    locale: 'fr',
    setLocale: () => {},
    t: (k: TKey) => DICT.fr[k] ?? k,
  };
}
