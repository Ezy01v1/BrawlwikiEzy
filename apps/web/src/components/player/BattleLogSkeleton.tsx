import { Skeleton } from '@/components/ui/Skeleton';

export function BattleLogSkeleton() {
  return (
    <div role="status" aria-label="Cargando partidas">
      <Skeleton className="h-6 w-48" />
      <div className="my-2 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[58px]" />
        ))}
      </div>
    </div>
  );
}
