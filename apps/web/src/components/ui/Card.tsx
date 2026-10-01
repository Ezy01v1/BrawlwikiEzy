import type { ComponentProps } from 'react';

export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return <div {...props} className={`rounded-card border border-border bg-surface p-3 ${className}`} />;
}
