import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary-fill text-on-primary font-display tracking-wide shadow-[0_3px_0_var(--primary-shadow)] hover:brightness-105 active:translate-y-0.5 active:shadow-[0_1px_0_var(--primary-shadow)]',
  secondary: 'border border-border font-semibold text-fg hover:bg-surface-2',
  ghost: 'text-muted hover:text-fg',
};

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 text-sm transition duration-150 ease-out disabled:pointer-events-none disabled:opacity-50';

export function buttonClass(variant: Variant = 'primary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

export function Button({ variant = 'primary', className = '', ...props }: ComponentProps<'button'> & { variant?: Variant }) {
  return <button type="button" {...props} className={buttonClass(variant, className)} />;
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={buttonClass(variant, className)} />;
}
