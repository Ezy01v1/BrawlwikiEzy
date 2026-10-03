import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { GameImage } from '@/components/ui/GameImage';

export const NEUTRAL = '#3a3a4a';

/** Arte sobre un fondo radial del color de rareza; la base oscura se mantiene en ambos temas, como una carta del juego. */
export function tileBackground(color: string | null): string {
  const c = color ?? NEUTRAL;
  return `radial-gradient(circle at 50% 35%, ${c} 0%, color-mix(in srgb, ${c} 30%, #0b0b0f) 75%)`;
}

interface BrawlerCardProps {
  name: string;
  imageUrl: string | null;
  color: string | null;
  label: string;
  href?: string;
  children: ReactNode;
}

const CARD =
  'block overflow-hidden rounded-card border border-border bg-surface transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--rarity)]';

/** Carta de brawler: el texto va siempre en la barra sólida de abajo, nunca sobre la imagen (spec, sección 5). */
export function BrawlerCard({ name, imageUrl, color, label, href, children }: BrawlerCardProps) {
  const style = { '--rarity': color ?? NEUTRAL } as CSSProperties;
  const body = (
    <>
      <div className="flex aspect-square items-end justify-center" style={{ background: tileBackground(color) }}>
        <GameImage src={imageUrl} alt={name} size={96} fallbackText={name} className="h-[85%] w-auto object-contain" />
      </div>
      <div aria-hidden="true" className="h-[3px] bg-[var(--rarity)]" />
      <div className="space-y-1 px-2 py-1">{children}</div>
    </>
  );
  return href ? (
    <Link href={href} aria-label={label} className={CARD} style={style}>
      {body}
    </Link>
  ) : (
    <article aria-label={label} className={CARD} style={style}>
      {body}
    </article>
  );
}
