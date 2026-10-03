import { Skeleton } from '@/components/ui/Skeleton';

export function CompareSkeleton() {
  return (
    <div role="status" aria-label="Cargando comparación" className="mt-6 space-y-3">
      <Skeleton className="h-12" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}
