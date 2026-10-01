'use client';

import { useEffect, useState } from 'react';
import { parseTheme, type Theme, themeCookie } from '@/lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(parseTheme(document.documentElement.dataset.theme));
  }, []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  function toggle() {
    document.documentElement.dataset.theme = next;
    document.cookie = themeCookie(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="inline-flex size-11 items-center justify-center rounded-chip text-muted transition-colors hover:text-fg"
    >
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
