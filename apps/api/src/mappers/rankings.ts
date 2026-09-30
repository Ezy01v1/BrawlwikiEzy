import type { ClubRanking, PlayerRanking } from '@brawlwiki/shared';
import { clubBadgeUrl, profileIconUrl } from '../assets/urls';
import type { RawClubRanking, RawList, RawPlayerRanking } from '../supercell/types';
import { stripHash } from './common';

export function toPlayerRankings(raw: RawList<RawPlayerRanking>): PlayerRanking[] {
  return raw.items.map((p) => ({
    rank: p.rank,
    tag: stripHash(p.tag),
    name: p.name,
    nameColor: p.nameColor ?? null,
    trophies: p.trophies,
    icon: { id: p.icon.id, imageUrl: profileIconUrl(p.icon.id) },
    clubName: p.club?.name ?? null,
  }));
}

export function toClubRankings(raw: RawList<RawClubRanking>): ClubRanking[] {
  return raw.items.map((c) => ({
    rank: c.rank,
    tag: stripHash(c.tag),
    name: c.name,
    trophies: c.trophies,
    badgeId: c.badgeId,
    badgeImageUrl: clubBadgeUrl(c.badgeId),
    memberCount: c.memberCount,
  }));
}
