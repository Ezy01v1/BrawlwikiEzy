import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createElement, type ImgHTMLAttributes } from 'react';
import { afterEach, vi } from 'vitest';

// next/image necesita el optimizador de Next; en jsdom se reemplaza por un <img> simple.
vi.mock('next/image', () => ({
  default: ({ src, alt, onError, width, height, className }: ImgHTMLAttributes<HTMLImageElement>) =>
    createElement('img', { src, alt, onError, width, height, className }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.cookie = 'theme=; max-age=0; path=/';
});
