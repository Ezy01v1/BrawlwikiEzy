import type { ReactNode } from 'react';

const TONES = {
  neutral: 'bg-surface-2 text-muted',
  win: 'bg-[color-mix(in_srgb,var(--win)_12%,var(--surface))] text-win',
  loss: 'bg-[color-mix(in_srgb,var(--loss)_12%,var(--surface))] text-loss',
  accent: 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] text-accent',
} as const;

export function Chip({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
