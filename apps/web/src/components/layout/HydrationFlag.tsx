'use client';

import { useEffect } from 'react';

/** Marca <html data-hydrated> cuando React terminó de hidratar; los E2E la esperan antes de interactuar. */
export function HydrationFlag() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return null;
}
