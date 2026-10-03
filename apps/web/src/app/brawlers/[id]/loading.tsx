import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando brawler" className="mt-4">
      <Skeleton className="h-11 w-40" />
      <div className="mt-2 grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
        <Skeleton className="aspect-square" />
        <div className="space-y-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    </div>
  );
}
