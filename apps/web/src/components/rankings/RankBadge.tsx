const PODIUM: Record<number, string> = {
  1: 'bg-[#ffc61a] text-[#14110a]',
  2: 'bg-[#c0c6d0] text-[#14110a]',
  3: 'bg-[#cd7f32] text-[#14110a]',
};

/** El número siempre se lee; el color del podio es un extra, nunca la única señal. */
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${PODIUM[rank] ?? 'text-muted'}`}
    >
      <span className="sr-only">Puesto </span>
      {rank}
    </span>
  );
}
