/** Formas crudas que devuelve https://api.brawlstars.com/v1. Solo los campos que usamos. */
export interface RawIcon {
  id: number;
}
export interface RawNamed {
  id: number;
  name: string;
}
export interface RawPlayerBrawler {
  id: number;
  name: string;
  power: number;
  rank: number;
  trophies: number;
  highestTrophies: number;
  gadgets?: RawNamed[];
  starPowers?: RawNamed[];
  gears?: (RawNamed & { level?: number })[];
}
export interface RawPlayer {
  tag: string;
  name: string;
  nameColor?: string;
  icon: RawIcon;
  trophies: number;
  highestTrophies: number;
  expLevel: number;
  '3vs3Victories'?: number;
  soloVictories?: number;
  duoVictories?: number;
  club?: { tag?: string; name?: string };
  brawlers: RawPlayerBrawler[];
}
export interface RawBattleBrawler {
  id: number;
  name: string;
  power: number;
  trophies: number;
}
export interface RawBattlePlayer {
  tag: string;
  name: string;
  brawler?: RawBattleBrawler;
  brawlers?: RawBattleBrawler[];
}
export interface RawEventRef {
  id?: number;
  mode?: string;
  map?: string | null;
}
export interface RawBattle {
  battleTime: string;
  event: RawEventRef;
  battle: {
    mode?: string;
    type?: string;
    result?: 'victory' | 'defeat' | 'draw';
    rank?: number;
    duration?: number;
    trophyChange?: number;
    starPlayer?: { tag: string } | null;
    teams?: RawBattlePlayer[][];
    players?: RawBattlePlayer[];
  };
}
export interface RawBattleLog {
  items: RawBattle[];
}
export interface RawClubMember {
  tag: string;
  name: string;
  nameColor?: string;
  role: string;
  trophies: number;
  icon: RawIcon;
}
export interface RawClub {
  tag: string;
  name: string;
  description?: string;
  type: string;
  badgeId: number;
  requiredTrophies: number;
  trophies: number;
  members?: RawClubMember[];
}
export interface RawPlayerRanking {
  tag: string;
  name: string;
  nameColor?: string;
  icon: RawIcon;
  trophies: number;
  rank: number;
  club?: { name: string };
}
export interface RawClubRanking {
  tag: string;
  name: string;
  badgeId: number;
  trophies: number;
  rank: number;
  memberCount: number;
}
export interface RawBrawler {
  id: number;
  name: string;
  starPowers?: RawNamed[];
  gadgets?: RawNamed[];
}
export interface RawEventSlot {
  startTime: string;
  endTime: string;
  slotId: number;
  event: RawEventRef;
}
export interface RawList<T> {
  items: T[];
}

/** Tags siempre normalizados y sin '#'. `region` es 'global' o un código ISO de 2 letras en mayúsculas. */
export interface SupercellApi {
  readonly mode: 'live' | 'mock';
  getPlayer(tag: string): Promise<RawPlayer>;
  getBattleLog(tag: string): Promise<RawBattleLog>;
  getClub(tag: string): Promise<RawClub>;
  getPlayerRankings(region: string, limit: number): Promise<RawList<RawPlayerRanking>>;
  getClubRankings(region: string, limit: number): Promise<RawList<RawClubRanking>>;
  getBrawlerRankings(region: string, brawlerId: number, limit: number): Promise<RawList<RawPlayerRanking>>;
  getBrawlers(): Promise<RawList<RawBrawler>>;
  getEventRotation(): Promise<RawEventSlot[]>;
}
