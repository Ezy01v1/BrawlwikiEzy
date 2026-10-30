'use client';

import { useActionState, useId, useState } from 'react';
import { deleteAccount } from '@/app/cuenta/actions';
import { buttonClass } from '@/components/ui/Button';
import { type ActionResult, DELETE_CONFIRM_WORD } from '@/lib/account';
import { ActionError } from './ActionError';

/** Borrar la cuenta pide escribir BORRAR; el servidor lo vuelve a comprobar. Si sale bien, la acción redirige a `/`. */
export function DeleteAccountForm() {
  const id = useId();
  const [value, setValue] = useState('');
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    (_prev, form) => deleteAccount(String(form.get('confirm') ?? '')),
    null,
  );
  const ready = value === DELETE_CONFIRM_WORD;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <p id={`${id}-warning`} className="text-sm text-muted">
        Se borran tu cuenta, tus favoritos y tus votos de la tier list. No se puede deshacer.
      </p>
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        Escribe {DELETE_CONFIRM_WORD} para confirmar
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          name="confirm"
          aria-describedby={`${id}-warning`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="min-h-11 w-full min-w-0 flex-1 rounded-card border border-border bg-surface-2 px-3 text-base text-fg sm:w-auto"
        />
        <button
          type="submit"
          disabled={!ready || pending}
          className={buttonClass('secondary', 'border-loss text-loss hover:bg-surface-2')}
        >
          {pending ? 'Borrando…' : 'Borrar cuenta'}
        </button>
      </div>
      {state && !state.ok && <ActionError code={state.code} />}
    </form>
  );
}
