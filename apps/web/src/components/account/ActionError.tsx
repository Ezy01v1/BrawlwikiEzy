'use client';

import { usePathname } from 'next/navigation';
import { type ActionErrorCode, actionErrorMessage, loginHref } from '@/lib/account';

/**
 * Error de una acción de cuenta, en línea. Con la sesión vencida ofrece entrar y volver a esta página.
 * `message` reemplaza el texto por defecto del código cuando no aplica (p. ej. INVALID_PARAM fuera de los tags).
 * `onNavigate` avisa justo antes de que un clic simple en "Entrar con Discord" saque al usuario de la página
 * (no con Ctrl/Cmd/Shift/Alt ni con otro botón: esos abren otra pestaña o ventana y esta se queda).
 */
export function ActionError({
  code,
  message,
  onNavigate,
}: {
  code: ActionErrorCode;
  message?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? '/';
  return (
    <div role="alert" className="text-sm text-loss">
      <p>{message ?? actionErrorMessage(code)}</p>
      {code === 'UNAUTHENTICATED' && (
        // <a> y no <Link>: un prefetch de /auth/discord arrancaría el OAuth (ver AccountMenu).
        <a
          href={loginHref(pathname)}
          onClick={(e) => {
            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) onNavigate?.();
          }}
          className="inline-flex min-h-11 items-center font-semibold text-fg underline underline-offset-2"
        >
          Entrar con Discord
        </a>
      )}
    </div>
  );
}
