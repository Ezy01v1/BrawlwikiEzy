'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { addFavorite, removeFavorite } from '@/app/favorites/actions';
import { ActionError } from '@/components/account/ActionError';
import type { ActionErrorCode } from '@/lib/account';
import { callAction } from '@/lib/action-call';
import { isFavorite, type SavedEntry, toggleFavorite } from '@/lib/local-store';

/**
 * Sin sesión guarda en `localStorage`, como siempre. Con sesión (`signedIn`) la cuenta es la fuente de verdad:
 * `initial` viene del servidor, marcar es optimista y, si la acción falla, vuelve atrás y muestra el error.
 */
export function FavoriteButton({
  entry,
  signedIn = false,
  initial = false,
}: {
  entry: SavedEntry;
  signedIn?: boolean;
  initial?: boolean;
}) {
  const [on, setOn] = useState(signedIn && initial);
  const [error, setError] = useState<ActionErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  // `pending` llega un render tarde: el ref frena un doble clic antes de eso.
  const busy = useRef(false);

  useEffect(() => {
    if (!signedIn) setOn(isFavorite(entry));
  }, [entry, signedIn]);

  // Tras una revalidación (p. ej. al importar los favoritos locales) el servidor manda el estado nuevo.
  useEffect(() => {
    if (signedIn) setOn(initial);
  }, [signedIn, initial]);

  function toggle() {
    if (!signedIn) {
      setOn(toggleFavorite(entry));
      return;
    }
    if (busy.current) return;
    busy.current = true;
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      try {
        const r = await callAction(() =>
          next ? addFavorite(entry.type, entry.tag, entry.name ?? '') : removeFavorite(entry.type, entry.tag),
        );
        if (!r.ok) {
          setOn(!next);
          setError(r.code);
        }
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        aria-busy={pending || undefined}
        onClick={toggle}
        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-chip text-xl transition-transform active:scale-90 ${on ? 'text-primary' : 'text-muted hover:text-fg'}`}
      >
        <span aria-hidden="true">{on ? '★' : '☆'}</span>
      </button>
      {error && (
        <div className="absolute right-0 top-full z-10 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-3">
          <ActionError code={error} />
        </div>
      )}
    </div>
  );
}
