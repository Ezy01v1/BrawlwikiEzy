export type Theme = 'dark' | 'light';

export const THEME_COOKIE = 'theme';

export function parseTheme(value: string | null | undefined): Theme {
  return value === 'light' ? 'light' : 'dark';
}

export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

/** Color de la barra del navegador (`<meta name="theme-color">`): el `--bg` de cada tema en globals.css. */
export const THEME_COLOR: Record<Theme, string> = { dark: '#0b0b0f', light: '#f5f5f7' };
