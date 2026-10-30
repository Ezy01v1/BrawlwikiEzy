'use client';

import { useState, useTransition } from 'react';
import { linkTag } from '@/app/cuenta/actions';
import { Button } from '@/components/ui/Button';
import type { ActionErrorCode } from '@/lib/account';
import { ActionError } from './ActionError';

/**
 * "Este soy yo": vincula el tag del perfil. Al terminar, la acción revalida, el servidor vuelve a renderizar con
 * `linked` y el botón desaparece; el status queda montado (mismo componente) y anuncia "Tag vinculado".
 */
export function ClaimTagButton({ tag, linked }: { tag: string; linked: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ActionErrorCode | null>(null);
  const [done, setDone] = useState(false);

  function claim() {
    setError(null);
    startTransition(async () => {
      const r = await linkTag(tag);
      if (r.ok) setDone(true);
      else setError(r.code);
    });
  }

  return (
    <div className="mt-3 flex flex-col items-start gap-1">
      {!linked && (
        <Button variant="secondary" onClick={claim} disabled={pending} aria-busy={pending || undefined}>
          {pending ? 'Guardando…' : 'Este soy yo'}
        </Button>
      )}
      {error && <ActionError code={error} />}
      <p role="status" className="text-sm text-muted">
        {done ? 'Tag vinculado' : ''}
      </p>
    </div>
  );
}
