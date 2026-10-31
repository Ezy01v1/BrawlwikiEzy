import type { Season } from '@brawlwiki/shared';
import { Button } from '@/components/ui/Button';

const CONTROL = 'min-h-11 w-full min-w-0 rounded-card border border-border bg-surface-2 px-3 text-base text-fg';

/** Formulario GET nativo (como los filtros del catálogo): la temporada queda en la URL y funciona sin JavaScript. */
export function SeasonPicker({ seasons, selectedId }: { seasons: Season[]; selectedId: number }) {
  return (
    <form method="get" action="/tierlist" aria-label="Elegir temporada" className="flex flex-wrap items-end gap-2">
      <label className="flex min-w-0 grow basis-48 flex-col gap-1 text-sm font-semibold text-muted">
        Temporada
        <select name="season" defaultValue={String(selectedId)} className={CONTROL}>
          {seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.endedAt === null ? `${s.name} (actual)` : s.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary">
        Ver
      </Button>
    </form>
  );
}
