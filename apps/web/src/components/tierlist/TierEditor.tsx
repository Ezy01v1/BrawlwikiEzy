'use client';

import type { Season } from '@brawlwiki/shared';
import { type CSSProperties, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { saveTierList } from '@/app/tierlist/actions';
import { ActionError } from '@/components/account/ActionError';
import { NEUTRAL, tileBackground } from '@/components/brawler/BrawlerCard';
import { Button } from '@/components/ui/Button';
import { GameImage } from '@/components/ui/GameImage';
import type { ActionErrorCode } from '@/lib/account';
import { callAction } from '@/lib/action-call';
import { sortByDisplayName } from '@/lib/brawlers';
import {
  clearDraft,
  MIN_PLACED,
  readDraft,
  sameVotes,
  TIER_OPTIONS,
  type TierValue,
  type TierVote,
  type TierVotes,
  tierLetter,
  UNPLACED_LABEL,
  votesFromList,
  votesToList,
  writeDraft,
} from '@/lib/tier-editor';
import { TIER_BADGE, UNTIERED_BADGE } from './tier-style';
import { TierPicker } from './TierPicker';

/** Lo que el editor necesita de cada brawler; `name` ya viene como lo ve el usuario ("El Primo"). */
export interface EditorBrawler {
  id: number;
  name: string;
  imageUrl: string | null;
  color: string | null;
}

interface TierEditorProps {
  season: Pick<Season, 'id' | 'name'>;
  brawlers: EditorBrawler[];
  initialVotes: TierVote[];
}

const SAVED_MESSAGE = 'Tu tier list se guardó';
const INVALID_MESSAGE = 'No pudimos guardar tu tier list. Recarga la página e inténtalo de nuevo.';

/**
 * Editor de la tier list propia. El estado de trabajo vive aquí y se copia en `sessionStorage` en cada cambio
 * (`bw:tier-draft:<temporada>`): si la sesión vence o se recarga la página, el borrador vuelve al montar.
 * "Guardar" manda la lista entera (la API reemplaza todos los votos) y solo se habilita con cambios.
 */
export function TierEditor({ season, brawlers, initialVotes }: TierEditorProps) {
  const sorted = useMemo(() => sortByDisplayName(brawlers), [brawlers]);
  const known = useMemo(() => new Set(brawlers.map((b) => b.id)), [brawlers]);
  const [saved, setSaved] = useState<TierVotes>(() => votesFromList(initialVotes, known));
  const [votes, setVotes] = useState<TierVotes>(saved);
  // Lo último elegido, para saber al terminar de guardar si hubo cambios mientras tanto.
  const latest = useRef(votes);
  const [openId, setOpenId] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<ActionErrorCode | null>(null);
  const [wait, setWait] = useState(0);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  // `pending` llega un render tarde: el ref frena un doble clic antes de eso.
  const busy = useRef(false);
  // Clic en "Entrar con Discord" tras una sesión vencida: el borrador ya está en sessionStorage, no hace falta
  // el "¿salir del sitio?" del navegador.
  const leaving = useRef(false);

  const dirty = !sameVotes(votes, saved);

  // El borrador se lee después de hidratar: en el servidor no hay sessionStorage.
  useEffect(() => {
    const draft = readDraft(season.id, known);
    if (draft) {
      latest.current = draft;
      setVotes(draft);
    }
  }, [season.id, known]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      // Navegadores viejos piden returnValue además de preventDefault.
      e.returnValue = '';
    };
    // Si vuelve con "atrás" (bfcache), la página sigue viva: se vuelve a avisar.
    const back = () => {
      leaving.current = false;
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pageshow', back);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('pageshow', back);
    };
  }, [dirty]);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const counts = useMemo(() => {
    const c: Record<TierValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const tier of Object.values(votes)) c[tier] += 1;
    return c;
  }, [votes]);
  const placed = Object.keys(votes).length;
  const unplaced = sorted.length - placed;

  function choose(id: number, tier: TierValue | null) {
    setOpenId(null);
    const next = { ...votes };
    if (tier === null) delete next[id];
    else next[id] = tier;
    latest.current = next;
    setVotes(next);
    setDone(false);
    if (sameVotes(next, saved)) clearDraft(season.id);
    else writeDraft(season.id, next);
  }

  function save() {
    if (busy.current || !dirty || wait > 0) return;
    busy.current = true;
    const snapshot = votes;
    setError(null);
    setDone(false);
    startTransition(async () => {
      try {
        const r = await callAction(() => saveTierList(votesToList(snapshot)));
        if (r.ok) {
          setSaved(snapshot);
          // Si se siguió editando mientras guardaba, el borrador nuevo se queda.
          if (sameVotes(latest.current, snapshot)) clearDraft(season.id);
          setDone(true);
        } else {
          setError(r.code);
          if ('retryAfter' in r && r.retryAfter) setWait(Math.ceil(r.retryAfter));
        }
      } finally {
        busy.current = false;
      }
    });
  }

  const open = openId === null ? null : (sorted.find((b) => b.id === openId) ?? null);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <section aria-label="Resumen" className="rounded-card border border-border bg-surface p-3">
        <ul aria-label="Resumen por tier" className="flex flex-wrap gap-2">
          {TIER_OPTIONS.map(({ letter, value }) => (
            <li
              key={letter}
              className={`rounded-chip border-2 bg-surface-2 px-2 py-0.5 font-display text-sm ${TIER_BADGE[letter]}`}
            >
              {letter}: {counts[value]}
            </li>
          ))}
          <li className={`rounded-chip border-2 bg-surface-2 px-2 py-0.5 text-sm font-semibold ${UNTIERED_BADGE}`}>
            {UNPLACED_LABEL}: {unplaced}
          </li>
        </ul>
        {placed < MIN_PLACED && (
          <p className="mt-2 text-sm text-muted">Ubica al menos {MIN_PLACED} brawlers para que tu voto cuente</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button onClick={save} disabled={!dirty || pending || wait > 0} aria-busy={pending || undefined}>
            {pending ? 'Guardando…' : wait > 0 ? `Guardar en ${wait} s` : 'Guardar'}
          </Button>
          {dirty && !pending && <p className="text-sm text-muted">Tienes cambios sin guardar</p>}
        </div>
        {error && (
          <div className="mt-2">
            <ActionError
              code={error}
              {...(error === 'INVALID_PARAM' ? { message: INVALID_MESSAGE } : {})}
              onNavigate={() => {
                leaving.current = true;
              }}
            />
          </div>
        )}
        <p role="status" className="mt-1 text-sm text-win">
          {done ? SAVED_MESSAGE : ''}
        </p>
      </section>

      <ul aria-label="Brawlers" className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
        {sorted.map((b) => {
          const letter = votes[b.id] ? tierLetter(votes[b.id]!) : null;
          return (
            <li key={b.id}>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`${b.name}, ${letter ? `tier ${letter}` : 'sin ubicar'}`}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setOpenId(b.id);
                }}
                className="block w-full overflow-hidden rounded-card border border-border bg-surface text-left transition-transform duration-150 ease-out hover:border-[var(--rarity)] active:scale-95"
                style={{ '--rarity': b.color ?? NEUTRAL } as CSSProperties}
              >
                <div className="flex aspect-square items-end justify-center" style={{ background: tileBackground(b.color) }}>
                  <GameImage
                    src={b.imageUrl}
                    alt=""
                    size={96}
                    fallbackText={b.name}
                    className="h-[85%] w-auto object-contain"
                  />
                </div>
                <div aria-hidden="true" className="h-[3px] bg-[var(--rarity)]" />
                <div className="flex min-h-8 items-center gap-1 px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{b.name}</span>
                  <span
                    aria-hidden="true"
                    className={`inline-flex size-6 shrink-0 items-center justify-center rounded-chip border-2 bg-surface-2 font-display text-sm ${letter ? TIER_BADGE[letter] : UNTIERED_BADGE}`}
                  >
                    {letter ?? '–'}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <TierPicker
          brawlerName={open.name}
          current={votes[open.id] ?? null}
          opener={opener.current}
          onChoose={(tier) => choose(open.id, tier)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
