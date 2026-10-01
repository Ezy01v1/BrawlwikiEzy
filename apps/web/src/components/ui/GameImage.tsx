'use client';

import Image from 'next/image';
import { useState } from 'react';

export function initials(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return letters || '?';
}

interface GameImageProps {
  src: string | null;
  alt: string;
  size: number;
  className?: string;
  fallbackText?: string;
}

/** Imagen del CDN con fallback: nunca se muestra un ícono roto. */
export function GameImage({ src, alt, size, className = '', fallbackText }: GameImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        style={{ width: size, height: size }}
        className={`inline-flex shrink-0 items-center justify-center rounded-chip bg-surface-2 font-display text-muted ${className}`}
      >
        {initials(fallbackText ?? alt)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
