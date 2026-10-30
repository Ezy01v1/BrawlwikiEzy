'use client';

import { usePathname } from 'next/navigation';
import { type ActionErrorCode, actionErrorMessage, loginHref } from '@/lib/account';

/** Error de una acción de cuenta, en línea. Con la sesión vencida ofrece entrar y volver a esta página. */
export function ActionError({ code }: { code: ActionErrorCode }) {
  const pathname = usePathname() ?? '/';
  return (
    <div role="alert" className="text-sm text-loss">
      <p>{actionErrorMessage(code)}</p>
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
