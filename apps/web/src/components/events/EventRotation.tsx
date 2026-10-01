import { ApiErrorView } from '@/components/states/ApiErrorView';
import { EmptyState } from '@/components/states/EmptyState';
import { StaleBadge } from '@/components/states/StaleBadge';
import { attempt } from '@/lib/attempt';
import { getEventRotation } from '@/lib/queries';
import { EventCard } from './EventCard';

export async function EventRotation() {
  const r = await attempt(getEventRotation());
  if (!r.ok) return <ApiErrorView error={r.error} />;
  const { data, meta } = r.value;
  if (data.length === 0) return <EmptyState title="No hay eventos activos" />;
  const now = Date.now();
  return (
    <>
      <StaleBadge meta={meta} />
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((slot) => (
          <li key={`${slot.slotId}-${slot.startTime}`}>
            <EventCard slot={slot} now={now} />
          </li>
        ))}
      </ul>
    </>
  );
}
