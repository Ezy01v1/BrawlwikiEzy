import type { Club } from '@brawlwiki/shared';

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
