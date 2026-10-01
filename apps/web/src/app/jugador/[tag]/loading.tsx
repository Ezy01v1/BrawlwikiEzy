import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Cargando perfil" className="mt-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-card" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>
      <Skeleton className="mt-5 h-[52px]" />
      <Skeleton className="mt-4 h-[76px]" />
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[60px]" />
        ))}
      </div>
    </div>
  );
}
