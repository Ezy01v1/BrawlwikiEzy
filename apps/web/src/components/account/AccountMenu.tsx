'use client';

import type { User } from '@brawlwiki/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GameImage } from '@/components/ui/GameImage';
import { loginHref, profileHref } from '@/lib/account';

/** Parte del header que depende de la sesión. Solo se monta con Comunidad activa. */
export function AccountMenu({ user }: { user: User | null }) {
  const pathname = usePathname() ?? '/';

  if (!user) {
    // <a> y no <Link>: Next prefetchea los Link visibles (y al pasar el mouse), y /auth/discord es un route handler
    // con efectos (arranca el OAuth y pisa la cookie de state; con AUTH_MOCK=1 hasta inicia sesión).
    return (
      <a
        href={loginHref(pathname)}
        className="inline-flex min-h-11 shrink-0 items-center rounded-chip px-3 text-sm font-semibold text-fg hover:bg-surface-2"
      >
        Entrar
      </a>
    );
  }

  const onAccount = pathname === '/cuenta';
  const profile = user.playerTag ? profileHref(user.playerTag) : null;
  return (
    <>
      {profile && (
        <Link
          href={profile}
          aria-current={pathname === profile ? 'page' : undefined}
          className={`inline-flex min-h-11 shrink-0 items-center rounded-chip px-2 text-sm font-semibold md:px-3 ${pathname === profile ? 'bg-surface-2 text-primary' : 'text-muted hover:text-fg'}`}
        >
          Mi perfil
        </Link>
      )}
      <Link
        href="/cuenta"
        aria-label="Mi cuenta"
        aria-current={onAccount ? 'page' : undefined}
        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full ${onAccount ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
      >
        <GameImage src={user.avatarUrl} alt="" size={32} fallbackText={user.username} className="rounded-full" />
      </Link>
    </>
  );
}
