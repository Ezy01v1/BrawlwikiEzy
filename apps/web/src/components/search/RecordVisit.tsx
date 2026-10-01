'use client';

import { useEffect } from 'react';
import { addRecent, type SavedEntry } from '@/lib/local-store';

/** Guarda la visita (con nombre) en recientes al abrir un perfil. */
export function RecordVisit({ entry }: { entry: SavedEntry }) {
  useEffect(() => {
    addRecent(entry);
  }, [entry]);
  return null;
}
