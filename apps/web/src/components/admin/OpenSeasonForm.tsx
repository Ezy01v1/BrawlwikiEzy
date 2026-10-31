'use client';

import { type FormEvent, useId, useRef, useState, useTransition } from 'react';
import { openSeason } from '@/app/admin/actions';
import { ActionError } from '@/components/account/ActionError';
import { Button } from '@/components/ui/Button';
import type { ActionErrorCode } from '@/lib/account';
import { callAction } from '@/lib/action-call';
import { SEASON_NAME_MAX, SEASON_NAME_MESSAGE } from '@/lib/admin';

/** Formulario para abrir una temporada nueva (cierra la activa). */
export function OpenSeasonForm() {
  const id = useId();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<ActionErrorCode | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // `pending` tarda un render en reflejarse: el ref frena un segundo envío inmediato.
  const lock = useRef(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    const name = value.trim();
    const bad = name.length < 1 || name.length > SEASON_NAME_MAX;
    setInvalid(bad);
    setError(null);
    setDone(null);
    if (bad) return;

    lock.current = true;
    startTransition(async () => {
      try {
        const r = await callAction(() => openSeason(name));
        if (!r.ok) {
          setError(r.code);
          return;
        }
        setValue('');
        setDone('Temporada abierta');
      } finally {
        lock.current = false;
      }
    });
  }

  const describedBy = invalid ? `${id}-hint ${id}-error` : `${id}-hint`;

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        Nombre de la temporada
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="min-h-11 w-full min-w-0 flex-1 rounded-card border border-border bg-surface-2 px-3 text-base text-fg placeholder:text-muted sm:w-auto"
        />
        <Button type="submit" disabled={pending}>
          Abrir temporada
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted">
        De 1 a {SEASON_NAME_MAX} caracteres. Abrir una temporada nueva cierra la temporada actual; los votos de la temporada
        anterior quedan como historial.
      </p>
      {invalid && (
        <p id={`${id}-error`} role="alert" className="text-sm text-loss">
          {SEASON_NAME_MESSAGE}
        </p>
      )}
      {error && <ActionError code={error} message={error === 'INVALID_PARAM' ? SEASON_NAME_MESSAGE : undefined} />}
      <p role="status" className="text-sm text-muted">
        {done}
      </p>
    </form>
  );
}
