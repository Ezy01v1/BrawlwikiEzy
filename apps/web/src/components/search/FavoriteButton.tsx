'use client';

import { useEffect, useState } from 'react';
import { isFavorite, type SavedEntry, toggleFavorite } from '@/lib/local-store';

export function FavoriteButton({ entry }: { entry: SavedEntry }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isFavorite(entry));
  }, [entry]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      onClick={() => setOn(toggleFavorite(entry))}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-chip text-xl transition-transform active:scale-90 ${on ? 'text-primary' : 'text-muted hover:text-fg'}`}
    >
      <span aria-hidden="true">{on ? '★' : '☆'}</span>
    </button>
  );
}
