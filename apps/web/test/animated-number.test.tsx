import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { formatNumber } from '@/lib/format';

let frames: FrameRequestCallback[] = [];
let now = 0;

beforeEach(() => {
  frames = [];
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Avanza el reloj y corre los frames pendientes, guardando lo que se vio en cada uno. */
function runFrames(container: HTMLElement, stepMs: number, count: number): string[] {
  const seen: string[] = [];
  for (let i = 0; i < count && frames.length > 0; i++) {
    now += stepMs;
    const pending = frames;
    frames = [];
    act(() => pending.forEach((cb) => cb(now)));
    seen.push(container.querySelector('[aria-hidden="true"]')!.textContent!);
  }
  return seen;
}

describe('AnimatedNumber', () => {
  it('al montar muestra el valor final y no anima desde 0 (el HTML del servidor ya trae el número)', () => {
    const { container } = render(<AnimatedNumber value={1000} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(formatNumber(1000));
    expect(frames).toHaveLength(0);
  });

  it('cuando el valor cambia anima desde el anterior, sin pasar por 0', () => {
    const { container, rerender } = render(<AnimatedNumber value={1000} />);
    rerender(<AnimatedNumber value={2000} />);
    const seen = runFrames(container, 100, 20).map((s) => Number(s.replace(/\D/g, '')));
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(1000);
    expect(seen.at(-1)).toBe(2000);
  });

  it('el lector de pantalla siempre recibe el valor final', () => {
    const { container, rerender } = render(<AnimatedNumber value={1000} />);
    rerender(<AnimatedNumber value={2000} />);
    expect(container.querySelector('.sr-only')).toHaveTextContent(formatNumber(2000));
  });
});
