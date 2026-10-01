import type { Meta } from '@brawlwiki/shared';
import { formatAge } from '@/lib/format';

export function StaleBadge({ meta }: { meta: Meta }) {
  if (meta.source !== 'stale') return null;
  return (
    <p role="status" className="my-2 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
      <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
      Dato de hace {formatAge(meta.ageSeconds)} · Supercell no responde
    </p>
  );
}
