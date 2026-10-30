import Link from 'next/link';
import { AccountMenu } from '@/components/account/AccountMenu';
import { TagSearch } from '@/components/search/TagSearch';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { getSession } from '@/lib/session';
import type { Theme } from '@/lib/theme';
import { ClubsLink, NavLinks } from './NavLinks';

/**
 * En móvil son dos filas (logo, Clubes y cuenta arriba; la búsqueda abajo, a todo el ancho) para que
 * "Mi perfil" y el avatar entren a 375 px sin scroll horizontal. Desde `md` es una sola fila.
 */
export async function Header({ theme }: { theme?: Theme } = {}) {
  const session = await getSession();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-1 gap-y-1 px-4 py-2 md:flex-nowrap md:gap-x-4 md:px-6">
        <Link
          href="/"
          aria-label="BrawlWiki, inicio"
          className="mr-1 shrink-0 font-display text-xl tracking-wide text-primary md:mr-0"
        >
          <span className="md:hidden">BW</span>
          <span className="hidden md:inline">BRAWLWIKI</span>
        </Link>
        <div className="flex items-center md:gap-1">
          <NavLinks variant="top" />
          <ClubsLink />
        </div>
        <div className="order-last w-full md:order-none md:ml-auto md:w-auto md:max-w-sm md:flex-1">
          <TagSearch variant="compact" />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          {session.enabled && <AccountMenu user={session.user} />}
          <ThemeToggle initial={theme} />
        </div>
      </div>
    </header>
  );
}
