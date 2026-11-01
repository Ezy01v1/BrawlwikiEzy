import { Skeleton } from '@/components/ui/Skeleton';

/** Misma forma que el editor: título, temporada, resumen y la grilla de cartas (la barra de "Guardar" va al final). */
export default function Loading() {
  return (
    <div role="status" aria-label="Cargando tu tier list" className="mt-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-2 h-4 w-64" />
      <Skeleton className="mt-4 h-20" />
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4]" />
        ))}
      </div>
    </div>
  );
}
