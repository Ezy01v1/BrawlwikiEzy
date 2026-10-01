import type { ReactNode } from 'react';

const TONES = {
  neutral: 'bg-surface-2 text-muted',
  win: 'bg-win/15 text-win',
  loss: 'bg-loss/15 text-loss',
  accent: 'bg-accent/15 text-accent',
} as const;

export function Chip({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[tone]}`}>
      {children}
    </span>
  );
}
