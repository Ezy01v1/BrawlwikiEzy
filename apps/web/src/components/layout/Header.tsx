import Link from 'next/link';
import { TagSearch } from '@/components/search/TagSearch';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NavLinks } from './NavLinks';

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 md:gap-4 md:px-6">
        <Link href="/" aria-label="BrawlWiki, inicio" className="shrink-0 font-display text-xl tracking-wide text-primary">
          <span className="md:hidden">BW</span>
          <span className="hidden md:inline">BRAWLWIKI</span>
        </Link>
        <NavLinks variant="top" />
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 md:max-w-sm">
          <TagSearch variant="compact" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
