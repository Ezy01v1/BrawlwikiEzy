'use client';

import { type KeyboardEvent, useEffect, useId, useRef } from 'react';
import { TIER_OPTIONS, type TierValue, UNPLACED_LABEL } from '@/lib/tier-editor';
import { TIER_BADGE, UNTIERED_BADGE } from './tier-style';

interface TierPickerProps {
  brawlerName: string;
  current: TierValue | null;
  /**
   * Adónde vuelve el foco al cerrar. Si no se pasa, a lo que tenía el foco al abrir; pero Safari no enfoca un
   * botón al tocarlo, así que quien abre pasa su carta.
   */
  opener?: HTMLElement | null;
  /** `null` = "Sin ubicar". */
  onChoose: (tier: TierValue | null) => void;
  onClose: () => void;
}

const OPTION =
  'inline-flex min-h-11 items-center justify-center rounded-chip border-2 bg-surface-2 font-display transition-transform active:scale-95 aria-pressed:ring-2 aria-pressed:ring-fg aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface';

/**
 * Selector modal de tier. El foco entra en la opción actual, queda atrapado (Tab y Shift+Tab dan la vuelta) y,
 * al desmontarse, vuelve a donde estaba (la carta que lo abrió). Escape, "Cerrar" y el fondo lo cierran.
 * Un modal a mano y no `<dialog>`: jsdom no atrapa el foco de `showModal()`, así que igual habría que hacerlo.
 */
export function TierPicker({ brawlerName, current, opener, onChoose, onClose }: TierPickerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Solo el valor del primer render: el foco vuelve a quien abrió, aunque el padre cambie la prop.
  const openerRef = useRef(opener);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const back = openerRef.current ?? previous;
    dialogRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    // La página de fondo no se desplaza mientras el modal está abierto (en móvil el dedo arrastraba la grilla).
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      back?.focus();
    };
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (at <= 0 ? items.length - 1 : at - 1) : at === -1 || at === items.length - 1 ? 0 : at + 1;
    items[next]!.focus();
  }

  return (
    // El fondo cierra con el mouse; con teclado está Escape y el botón "Cerrar".
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="w-full max-w-sm rounded-card border border-border bg-surface p-4 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="min-w-0 truncate font-display text-xl">
            {brawlerName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-chip px-3 text-sm font-semibold text-muted hover:text-fg"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {TIER_OPTIONS.map(({ letter, value }) => (
            <button
              key={letter}
              type="button"
              aria-pressed={current === value}
              onClick={() => onChoose(value)}
              className={`${OPTION} text-2xl ${TIER_BADGE[letter]}`}
            >
              {letter}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={current === null}
          onClick={() => onChoose(null)}
          className={`${OPTION} mt-2 w-full text-sm ${UNTIERED_BADGE}`}
        >
          {UNPLACED_LABEL}
        </button>
      </div>
    </div>
  );
}
