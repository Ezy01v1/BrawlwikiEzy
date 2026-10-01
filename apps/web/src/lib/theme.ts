export type Theme = 'dark' | 'light';

export const THEME_COOKIE = 'theme';

export function parseTheme(value: string | null | undefined): Theme {
  return value === 'light' ? 'light' : 'dark';
}

export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}
