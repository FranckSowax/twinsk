'use client';

// Bouton clair / sombre de l'espace projet. Le choix est posé en data-theme
// sur le conteneur de la page (voir @custom-variant dark dans globals.css) et
// mémorisé sur l'appareil ; sans choix, la page suit le réglage du système.

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEME_COLORS, THEME_KEY } from '@/lib/projects/theme';

type Theme = 'light' | 'dark';

function root(): HTMLElement | null {
  return document.querySelector('[data-theme-root]');
}
function effective(): Theme {
  const t = root()?.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    // Différé : la règle react-hooks refuse un setState synchrone dans l'effet.
    const t = setTimeout(() => setTheme(effective()), 0);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(effective());
    mq.addEventListener('change', onChange);
    return () => {
      clearTimeout(t);
      mq.removeEventListener('change', onChange);
    };
  }, []);
  const toggle = () => {
    const next: Theme = effective() === 'dark' ? 'light' : 'dark';
    const el = root();
    if (el) {
      el.setAttribute('data-theme', next);
      el.style.colorScheme = next;
    }
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[next]));
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* stockage indisponible (navigation privée) : le choix vaut pour la visite */
    }
    setTheme(next);
  };
  const dark = theme === 'dark';
  return (
    <button type="button" onClick={toggle} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:text-amber-300 dark:hover:bg-slate-800 sm:h-9 sm:w-9" aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'} title={dark ? 'Thème clair' : 'Thème sombre'}>
      {theme == null ? <span className="h-4 w-4" /> : dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
