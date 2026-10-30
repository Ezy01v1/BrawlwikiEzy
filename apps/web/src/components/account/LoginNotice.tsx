'use client';

import { useSearchParams } from 'next/navigation';

const NOTICES = {
  login: 'No se pudo iniciar sesión con Discord',
  logout: 'No se pudo cerrar la sesión. Inténtalo de nuevo.',
} as const;

/**
 * Aviso de `?login=error` / `?logout=error` en cualquier página. Va en el layout dentro de un `<Suspense>`:
 * `useSearchParams` no puede leerse en el layout y, sin el boundary, haría client-side todo lo que tiene encima.
 */
export function LoginNotice() {
  const params = useSearchParams();
  const kind = params.get('login') === 'error' ? 'login' : params.get('logout') === 'error' ? 'logout' : null;
  if (!kind) return null;
  return (
    <p
      role="alert"
      className="mx-auto mt-4 max-w-xl rounded-card border border-loss bg-surface px-4 py-3 text-center text-sm text-fg"
    >
      {NOTICES[kind]}
    </p>
  );
}
