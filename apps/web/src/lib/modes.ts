const MODE_NAMES: Record<string, string> = {
  gemGrab: 'Atrapagemas',
  brawlBall: 'Balón Brawl',
  heist: 'Atraco',
  bounty: 'Caza estelar',
  knockout: 'Noqueo',
  hotZone: 'Zona restringida',
  wipeout: 'Eliminación',
  duels: 'Duelos',
  soloShowdown: 'Supervivencia',
  duoShowdown: 'Supervivencia a dúo',
  trioShowdown: 'Supervivencia a trío',
  basketBrawl: 'Básquet Brawl',
  volleyBrawl: 'Vóley Brawl',
  payload: 'Carga',
  siege: 'Asedio',
  bossFight: 'Pelea contra el jefe',
  roboRumble: 'Robo Rumble',
  bigGame: 'Gran cacería',
  hunters: 'Cazadores',
  unknown: 'Modo desconocido',
};

export function modeName(key: string): string {
  return MODE_NAMES[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}
