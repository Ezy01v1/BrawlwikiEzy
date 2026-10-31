'use client';

import { usePathname } from 'next/navigation';
import { type ActionErrorCode, actionErrorMessage, loginHref } from '@/lib/account';

/**
 * Error de una acción de cuenta, en línea. Con la sesión vencida ofrece entrar y volver a esta página.
 * `message` reemplaza el texto por defecto del código cuando no aplica (p. ej. INVALID_PARAM fuera de los tags).
 */
export function ActionError({ code, message }: { code: ActionErrorCode; message?: string }) {
  const pathname = usePathname() ?? '/';
  return (
    <div role="alert" className="text-sm text-loss">
      <p>{message ?? actionErrorMessage(code)}</p>
      {code === 'UNAUTHENTICATED' && (
        // <a> y no <Link>: un prefetch de /auth/discord arrancaría el OAuth (ver AccountMenu).
        <a
          href={loginHref(pathname)}
          className="inline-flex min-h-11 items-center font-semibold text-fg underline underline-offset-2"
        >
          Entrar con Discord
        </a>
      )}
    </div>
  );
}
