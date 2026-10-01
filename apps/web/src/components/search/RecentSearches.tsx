'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getFavorites, getRecent, type SavedEntry } from '@/lib/local-store';

const SOURCES = {
  recent: { get: getRecent, title: 'RECIENTES', id: 'recientes' },
  favorites: { get: getFavorites, title: 'FAVORITOS', id: 'favoritos' },
} as const;

export function SavedList({ source }: { source: keyof typeof SOURCES }) {
  const [items, setItems] = useState<SavedEntry[]>([]);
  const { get, title, id } = SOURCES[source];

  useEffect(() => {
    setItems(get());
  }, [get]);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby={id} className="my-6">
      <h2 id={id} className="mb-2 font-display text-sm tracking-wide text-muted">
        {title}
      </h2>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {items.map((e) => (
          <li key={`${e.type}:${e.tag}`}>
            <Link
              href={e.type === 'player' ? `/jugador/${e.tag}` : `/club/${e.tag}`}
              className="flex min-h-11 items-center justify-between gap-3 px-3 hover:bg-surface-2"
            >
              <span className="truncate font-semibold">{e.name ?? `#${e.tag}`}</span>
              <span className="shrink-0 text-xs text-muted">{e.type === 'player' ? 'jugador' : 'club'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Alias para no romper imports existentes. */
export function RecentSearches() {
  return <SavedList source="recent" />;
}
