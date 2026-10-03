import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando brawlers" className="mt-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-3 h-11" />
      <Skeleton className="mt-3 h-4 w-48" />
      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {Array.from({ length: 16 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4]" />
        ))}
      </div>
    </div>
  );
}
