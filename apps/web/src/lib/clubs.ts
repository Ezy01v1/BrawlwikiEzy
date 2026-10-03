import type { Club } from '@brawlwiki/shared';
import { parseTag } from '@brawlwiki/shared/tags';

const ROLES: Record<string, string> = {
  president: 'Presidente',
  vicePresident: 'Vicepresidente',
  senior: 'Veterano',
  member: 'Miembro',
};

const TYPES: Record<string, string> = {
  open: 'Abierto',
  inviteOnly: 'Solo por invitación',
  closed: 'Cerrado',
};

export function roleLabel(role: string): string {
  return ROLES[role] ?? role;
}

export function clubTypeLabel(type: string): string {
  return TYPES[type] ?? type;
}

export const CLUB_CAPACITY = 30;

export interface ClubSummary {
  members: number;
  average: number;
  best: number;
}

/** Promedio entero sobre los miembros listados; un club sin miembros da 0, nunca NaN. */
export function summarizeClub(club: Club): ClubSummary {
  const n = club.members.length;
  if (n === 0) return { members: 0, average: 0, best: 0 };
  const total = club.members.reduce((sum, m) => sum + m.trophies, 0);
  return { members: n, average: Math.round(total / n), best: Math.max(...club.members.map((m) => m.trophies)) };
}

export type Side = 'a' | 'b';

export interface CompareMetric {
  label: string;
  a: number;
  b: number;
  winner: Side | null;
}

/** "winner" marca el valor mayor (no siempre "mejor": más trofeos requeridos es más exigente). */
export function compareClubs(a: Club, b: Club): CompareMetric[] {
  const sa = summarizeClub(a);
  const sb = summarizeClub(b);
  const rows: [string, number, number][] = [
    ['Trofeos totales', a.trophies, b.trophies],
    ['Miembros', sa.members, sb.members],
    ['Promedio por miembro', sa.average, sb.average],
    ['Mejor jugador', sa.best, sb.best],
    ['Trofeos requeridos', a.requiredTrophies, b.requiredTrophies],
  ];
  return rows.map(([label, va, vb]) => ({ label, a: va, b: vb, winner: va === vb ? null : va > vb ? 'a' : 'b' }));
}

export const COMPARE_INVALID = 'Tag inválido. Usa solo 0289PYLQGRJCUV (la letra O cuenta como cero).';

export interface CompareParams {
  a: string | null;
  b: string | null;
  rawA: string;
  rawB: string;
  errors: { a?: string; b?: string };
}

export function parseCompareParams(rawA = '', rawB = ''): CompareParams {
  const a = rawA.trim() ? parseTag(rawA) : null;
  const b = rawB.trim() ? parseTag(rawB) : null;
  const errors: CompareParams['errors'] = {};
  if (rawA.trim() && !a) errors.a = COMPARE_INVALID;
  if (rawB.trim() && !b) errors.b = COMPARE_INVALID;
  else if (a && b && a === b) errors.b = 'Elige un club distinto al Club A.';
  return { a, b, rawA, rawB, errors };
}
