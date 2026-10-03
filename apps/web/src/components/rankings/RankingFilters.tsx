import { Button } from '@/components/ui/Button';
import { displayName } from '@/lib/format';
import { type RankingType, regionOptions } from '@/lib/rankings';

interface Props {
  tipo: RankingType;
  region: string;
  brawler: number | null;
  brawlers: { id: number; name: string }[];
}

const FIELD = 'flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted';
const SELECT = 'min-h-11 rounded-card border border-border bg-surface-2 px-3 text-base text-fg';

/** Formulario GET nativo: funciona sin JavaScript y deja los filtros en la URL. */
export function RankingFilters({ tipo, region, brawler, brawlers }: Props) {
  return (
    <form method="get" action="/rankings" className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tipo" value={tipo} />
      <label className={FIELD}>
        Región
        <select name="region" defaultValue={region} className={SELECT}>
          {regionOptions(region).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {tipo === 'brawler' && (
        <label className={FIELD}>
          Brawler
          <select name="brawler" defaultValue={brawler ? String(brawler) : ''} className={SELECT}>
            <option value="" disabled>
              Elige un brawler
            </option>
            {brawlers.map((b) => (
              <option key={b.id} value={b.id}>
                {displayName(b.name)}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button type="submit" variant="secondary">
        Ver ranking
      </Button>
    </form>
  );
}
