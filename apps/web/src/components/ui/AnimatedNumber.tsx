'use client';

import { useEffect, useState } from 'react';
import { formatNumber } from '@/lib/format';

const DURATION_MS = 700;

export function AnimatedNumber({ value, className = '' }: { value: number; className?: string }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION_MS);
      setShown(Math.round(value * (1 - (1 - p) ** 3)));
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
