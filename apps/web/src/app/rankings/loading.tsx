import { LeaderboardSkeleton } from '@/components/rankings/LeaderboardSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="mt-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="my-3 h-[52px]" />
      <Skeleton className="mb-4 h-11 w-64" />
      <LeaderboardSkeleton />
    </div>
  );
}
