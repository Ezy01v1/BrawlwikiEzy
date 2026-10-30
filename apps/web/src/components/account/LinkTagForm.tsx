'use client';

import { parseTag } from '@brawlwiki/shared/tags';
import { type FormEvent, useId, useState, useTransition } from 'react';
import { linkTag } from '@/app/cuenta/actions';
import { Button } from '@/components/ui/Button';
import { type ActionErrorCode, INVALID_TAG_MESSAGE } from '@/lib/account';
import { ActionError } from './ActionError';

/** Cambiar o quitar el tag vinculado desde /cuenta. */
export function LinkTagForm({ current }: { current: string | null }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<ActionErrorCode | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(tag: string | null, success: string) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const r = await linkTag(tag);
      if (!r.ok) {
        setError(r.code);
        return;
      }
      setValue('');
      setDone(success);
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const tag = parseTag(value);
    setInvalid(!tag);
    setError(null);
    setDone(null);
    if (tag) run(tag, 'Tag guardado.');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        Tu tag de Brawl Stars
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="#2PP"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className="min-h-11 w-full min-w-0 flex-1 rounded-card border border-border bg-surface-2 px-3 text-base uppercase text-fg placeholder:normal-case placeholder:text-muted sm:w-auto"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {current ? 'Cambiar tag' : 'Guardar tag'}
        </Button>
        {current && (
          <Button variant="ghost" disabled={pending} onClick={() => run(null, 'Tag quitado.')}>
            Quitar tag
          </Button>
        )}
      </div>
      {invalid && (
        <p id={`${id}-error`} role="alert" className="text-sm text-loss">
          {INVALID_TAG_MESSAGE}
        </p>
      )}
      {error && <ActionError code={error} />}
      <p role="status" className="text-sm text-muted">
        {done}
      </p>
    </form>
  );
}
