export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export const PLAYER_TABS = ['resumen', 'brawlers', 'partidas'] as const;
export type PlayerTab = (typeof PLAYER_TABS)[number];

export function parseTab(value: string | undefined): PlayerTab {
  return (PLAYER_TABS as readonly string[]).includes(value ?? '') ? (value as PlayerTab) : 'resumen';
}
