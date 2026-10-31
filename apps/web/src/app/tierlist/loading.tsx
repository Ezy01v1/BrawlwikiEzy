import { Skeleton } from '@/components/ui/Skeleton';

/** Misma forma que la página: título, temporada, selector, CTA y las seis filas. */
export default function Loading() {
  return (
    <div role="status" aria-label="Cargando la tier list" className="mt-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <Skeleton className="mt-3 h-[68px]" />
      <Skeleton className="mt-3 h-11 w-52" />
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}
