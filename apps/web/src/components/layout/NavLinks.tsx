'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_ITEMS = [
  { href: '/', label: 'Inicio', icon: '🏠' },
  { href: '/rankings', label: 'Rankings', icon: '🏆' },
  { href: '/brawlers', label: 'Brawlers', icon: '🥊' },
  { href: '/clubes/comparar', label: 'Clubes', icon: '🛡️' },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/clubes/comparar') return pathname.startsWith('/clubes') || pathname.startsWith('/club/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ variant }: { variant: 'bottom' | 'top' }) {
  const pathname = usePathname() ?? '/';

  if (variant === 'bottom') {
    return (
      <nav
        aria-label="Navegación inferior"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'font-bold text-primary' : 'text-muted'}`}
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Navegación principal" className="hidden md:block">
      <ul className="flex gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-chip px-3 text-sm font-semibold ${active ? 'bg-surface-2 text-primary' : 'text-muted hover:text-fg'}`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
