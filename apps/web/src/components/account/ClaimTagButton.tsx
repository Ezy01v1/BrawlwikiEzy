'use client';

import { useState, useTransition } from 'react';
import { linkTag } from '@/app/cuenta/actions';
import { Button } from '@/components/ui/Button';
import type { ActionErrorCode } from '@/lib/account';
import { ActionError } from './ActionError';

/** "Este soy yo": vincula el tag del perfil. Al terminar, la acción revalida y el botón deja de mostrarse. */
export function ClaimTagButton({ tag }: { tag: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ActionErrorCode | null>(null);

  function claim() {
    setError(null);
    startTransition(async () => {
      const r = await linkTag(tag);
      if (!r.ok) setError(r.code);
    });
  }

  return (
    <div className="mt-3 flex flex-col items-start gap-1">
      <Button variant="secondary" onClick={claim} disabled={pending} aria-busy={pending || undefined}>
        {pending ? 'Guardando…' : 'Este soy yo'}
      </Button>
      {error && <ActionError code={error} />}
    </div>
  );
}
