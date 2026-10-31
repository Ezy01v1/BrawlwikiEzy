'use client';

import { useEffect, useState } from 'react';
import { importFavorites } from '@/app/favorites/actions';
import { toImportItems } from '@/lib/favorites';
import { clearFavorites, getFavorites } from '@/lib/local-store';

/**
 * Importación en curso, compartida por todas las instancias: el doble efecto de StrictMode (o dos montajes) se
 * suman a la misma llamada en vez de mandar otra. Al terminar se libera: si salió bien ya no quedan favoritos
 * locales; si falló, el próximo montaje (la próxima carga) reintenta.
 */
let inflight: Promise<number | null> | null = null;

function runImport(): Promise<number | null> | null {
  if (inflight) return inflight;
  const items = toImportItems(getFavorites());
  if (items.length === 0) return null;
  inflight = importFavorites(items)
    .then((r) => {
      if (!r.ok) return null;
      clearFavorites();
      return r.imported;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function message(n: number): string {
  return n === 1 ? 'Subimos tu favorito a tu cuenta' : `Subimos tus ${n} favoritos a tu cuenta`;
}

/**
 * Primer login: sube los favoritos de `localStorage` a la cuenta, los borra de aquí y avisa cuántos eran nuevos.
 * El layout lo monta solo con Comunidad activa y sesión. Si falla no avisa y deja los locales para reintentar.
 */
export function FavoritesImporter() {
  const [imported, setImported] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void runImport()?.then((n) => {
      if (active && n) setImported(n);
    });
    return () => {
      active = false;
    };
  }, []);

  // El status queda montado para que el lector de pantalla anuncie el texto cuando aparece.
  return (
    <div role="status" className="empty:hidden">
      {imported !== null && (
        <div className="mx-auto mt-4 flex max-w-xl items-center justify-between gap-3 rounded-card border border-border bg-surface py-1 pl-4 pr-1 text-sm text-fg">
          <p>{message(imported)}</p>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setImported(null)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-chip text-lg text-muted hover:text-fg"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}
    </div>
  );
}
