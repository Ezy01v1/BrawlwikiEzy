'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getRecent, type SavedEntry } from '@/lib/local-store';

export function RecentSearches() {
  const [items, setItems] = useState<SavedEntry[]>([]);

  useEffect(() => {
    setItems(getRecent());
  }, []);

  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recientes" className="my-6">
      <h2 id="recientes" className="mb-2 font-display text-sm tracking-wide text-muted">
        RECIENTES
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
