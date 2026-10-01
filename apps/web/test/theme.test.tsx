import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { parseTheme, themeCookie } from '@/lib/theme';

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'dark';
  });

  it('parseTheme: dark por defecto', () => {
    expect(parseTheme(undefined)).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('rosa')).toBe('dark');
  });

  it('themeCookie dura un año en todo el sitio', () => {
    expect(themeCookie('light')).toBe('theme=light; path=/; max-age=31536000; samesite=lax');
  });

  it('ThemeToggle alterna data-theme y guarda la cookie', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Cambiar a modo claro' });
    await userEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.cookie).toContain('theme=light');
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toBeInTheDocument();
  });
});
