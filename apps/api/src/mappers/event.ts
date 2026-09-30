import { type EventSlot, parseSupercellDate } from '@brawlwiki/shared';
import { mapImageUrl } from '../assets/urls';
import type { RawEventSlot } from '../supercell/types';

export function toEventSlots(raw: RawEventSlot[]): EventSlot[] {
  return raw.map((s) => {
    const mapId = s.event.id || null;
    return {
      slotId: s.slotId,
      startTime: parseSupercellDate(s.startTime),
      endTime: parseSupercellDate(s.endTime),
      mode: { name: s.event.mode ?? 'unknown', imageUrl: null },
      map: { id: mapId, name: s.event.map ?? null, imageUrl: mapImageUrl(mapId) },
    };
  });
}
