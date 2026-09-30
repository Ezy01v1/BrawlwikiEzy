import type { Club } from '@brawlwiki/shared';
import { clubBadgeUrl, profileIconUrl } from '../assets/urls';
import type { RawClub } from '../supercell/types';
import { stripHash } from './common';

export function toClub(raw: RawClub): Club {
  return {
    tag: stripHash(raw.tag),
    name: raw.name,
    description: raw.description ?? '',
    type: raw.type,
    badgeId: raw.badgeId,
    badgeImageUrl: clubBadgeUrl(raw.badgeId),
    requiredTrophies: raw.requiredTrophies,
    trophies: raw.trophies,
    members: (raw.members ?? [])
      .map((m) => ({
        tag: stripHash(m.tag),
        name: m.name,
        nameColor: m.nameColor ?? null,
        role: m.role,
        trophies: m.trophies,
        icon: { id: m.icon.id, imageUrl: profileIconUrl(m.icon.id) },
      }))
      .sort((a, b) => b.trophies - a.trophies),
  };
}
