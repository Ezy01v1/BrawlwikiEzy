'use client';

import { parseTag } from '@brawlwiki/shared/tags';
import { useRouter } from 'next/navigation';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/Button';

const INVALID = 'Ese tag no es válido. Los tags solo usan 0289PYLQGRJCUV (la letra O se toma como cero).';

export function TagSearch({ variant = 'hero', target = 'player' }: { variant?: 'hero' | 'compact'; target?: 'player' | 'club' }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const label = target === 'player' ? 'Tag del jugador' : 'Tag del club';

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const tag = parseTag(value);
    if (!tag) {
      setError(INVALID);
      return;
    }
    setError(null);
    router.push(target === 'player' ? `/jugador/${tag}` : `/club/${tag}`);
  }

  const compact = variant === 'compact';
  return (
    <form role="search" onSubmit={submit} className={compact ? 'flex w-full gap-2' : 'flex flex-col gap-2'}>
      <label htmlFor={id} className={compact ? 'sr-only' : 'text-sm font-semibold text-muted'}>
        {label}
      </label>
      <div className="flex w-full gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="#2PP"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-11 w-full min-w-0 rounded-card border border-border bg-surface-2 px-3 text-base uppercase text-fg placeholder:normal-case placeholder:text-muted"
        />
        <Button type="submit" variant={compact ? 'secondary' : 'primary'}>
          Buscar
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
    </form>
  );
}
