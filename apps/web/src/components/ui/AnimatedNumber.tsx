'use client';

import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '@/lib/format';

const DURATION_MS = 700;

/**
 * Al montar muestra el valor tal cual: el HTML del servidor ya lo trae, y animar desde 0 al hidratar hacía que el
 * número se borrara y volviera a contar. Solo anima cuando `value` cambia, desde el valor anterior.
 */
export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);
  // Lo que está en pantalla: si el efecto se corta a mitad de camino (o React lo corre dos veces), se sigue desde acá.
  const displayed = useRef(value);

  useEffect(() => {
    const start = displayed.current;
    if (start === value) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      displayed.current = value;
      setShown(value);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / DURATION_MS);
      displayed.current = Math.round(start + (value - start) * (1 - (1 - p) ** 3));
      setShown(displayed.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={`tabular-nums ${className}`}>
      <span aria-hidden="true">{formatNumber(shown)}</span>
      <span className="sr-only">{formatNumber(value)}</span>
    </span>
  );
}
