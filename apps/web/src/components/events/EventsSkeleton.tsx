import { Skeleton } from '@/components/ui/Skeleton';

export function EventsSkeleton() {
  return (
    <div role="status" aria-label="Cargando eventos" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[74px]" />
      ))}
    </div>
  );
}
