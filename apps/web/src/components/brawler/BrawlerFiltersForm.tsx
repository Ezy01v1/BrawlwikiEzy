import { Button, ButtonLink } from '@/components/ui/Button';
import { type BrawlerFilters, classLabel, type Facets, rarityLabel } from '@/lib/catalog';

const FIELD = 'flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted';
const CONTROL = 'min-h-11 w-full min-w-0 rounded-card border border-border bg-surface-2 px-3 text-base text-fg';

/** Formulario GET nativo: los filtros quedan en la URL y funciona sin JavaScript. */
export function BrawlerFiltersForm({ facets, values }: { facets: Facets; values: BrawlerFilters }) {
  const active = Boolean(values.q || values.rareza || values.clase);
  return (
    <form
      method="get"
      action="/brawlers"
      role="search"
      aria-label="Filtrar brawlers"
      className="flex flex-wrap items-end gap-2"
    >
      <label className={`${FIELD} grow basis-48`}>
        Buscar brawler
        <input
          name="q"
          defaultValue={values.q ?? ''}
          placeholder="Ej. Shelly"
          autoComplete="off"
          className={`${CONTROL} placeholder:text-muted`}
        />
      </label>
      {facets.rarities.length > 0 && (
        <label className={FIELD}>
          Rareza
          <select name="rareza" defaultValue={values.rareza ?? ''} className={CONTROL}>
            <option value="">Todas</option>
            {facets.rarities.map((r) => (
              <option key={r} value={r}>
                {rarityLabel(r)}
              </option>
            ))}
          </select>
        </label>
      )}
      {facets.classes.length > 0 && (
        <label className={FIELD}>
          Clase
          <select name="clase" defaultValue={values.clase ?? ''} className={CONTROL}>
            <option value="">Todas</option>
            {facets.classes.map((c) => (
              <option key={c} value={c}>
                {classLabel(c)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button type="submit" variant="secondary">
        Filtrar
      </Button>
      {active && (
        <ButtonLink href="/brawlers" variant="ghost">
          Quitar filtros
        </ButtonLink>
      )}
    </form>
  );
}
