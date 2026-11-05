import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { parseTheme, THEME_COLOR, themeCookie } from '@/lib/theme';

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

  it('ThemeToggle con initial="light" muestra el botón correcto antes de hidratar', () => {
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle initial="light" />);
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toBeInTheDocument();
  });

  it('ThemeToggle alterna data-theme y guarda la cookie', async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button', { name: 'Cambiar a modo claro' });
    await userEvent.click(button);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.cookie).toContain('theme=light');
    expect(screen.getByRole('button', { name: 'Cambiar a modo oscuro' })).toBeInTheDocument();
  });

  it('THEME_COLOR coincide con el --bg de cada tema', () => {
    const css = readFileSync(join(__dirname, '../src/app/globals.css'), 'utf8');
    const bgs = [...css.matchAll(/--bg: (#[0-9a-f]{6});/g)].map((m) => m[1]);
    expect(bgs).toEqual([THEME_COLOR.dark, THEME_COLOR.light]);
  });

  it('ThemeToggle también cambia el color de la barra del navegador (<meta name="theme-color">)', async () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = THEME_COLOR.dark;
    document.head.append(meta);
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar a modo claro' }));
    expect(meta.content).toBe(THEME_COLOR.light);
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar a modo oscuro' }));
    expect(meta.content).toBe(THEME_COLOR.dark);
    meta.remove();
  });
});
