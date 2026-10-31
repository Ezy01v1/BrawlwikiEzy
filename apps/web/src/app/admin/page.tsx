import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OpenSeasonForm } from '@/components/admin/OpenSeasonForm';
import { ApiErrorView } from '@/components/states/ApiErrorView';
import { Card } from '@/components/ui/Card';
import { attempt } from '@/lib/attempt';
import { formatDate } from '@/lib/format';
import { getSeasons } from '@/lib/queries';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Administración', robots: { index: false } };

export default async function AdminPage() {
  const { enabled, user } = await getSession();
  // Mismo 404 para todos los que no son administradores: la página no revela que existe.
  if (!enabled || !user?.isAdmin) notFound();

  const seasons = await attempt(getSeasons());

  return (
    <div className="mx-auto my-6 flex max-w-xl flex-col gap-4">
      <h1 className="font-display text-3xl">Administración</h1>

      <Card>
        <section aria-labelledby="admin-temporadas" className="flex flex-col gap-3">
          <h2 id="admin-temporadas" className="font-display text-lg">
            Temporadas
          </h2>
          {seasons.ok ? (
            <ul className="flex flex-col divide-y divide-border">
              {seasons.value.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                  <span className="min-w-0 break-words font-semibold">{s.name}</span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    Desde {formatDate(s.startedAt)}
                    {s.endedAt === null && (
                      <span className="rounded-card border border-border px-2 py-0.5 text-xs font-semibold text-fg">Activa</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <ApiErrorView error={seasons.error} />
          )}
        </section>
      </Card>

      <Card>
        <section aria-labelledby="admin-abrir" className="flex flex-col gap-3">
          <h2 id="admin-abrir" className="font-display text-lg">
            Abrir temporada nueva
          </h2>
          <OpenSeasonForm />
        </section>
      </Card>
    </div>
  );
}
