import { z } from 'zod';
import { TAG_REGEX } from './tags';

const Tag = z.string().regex(TAG_REGEX);
const IsoDate = z.string().datetime();
const Url = z.string().url();

export const ErrorCodeSchema = z.enum([
  'INVALID_TAG',
  'INVALID_PARAM',
  'NOT_FOUND',
  'RATE_LIMITED',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_MAINTENANCE',
  'UPSTREAM_UNAVAILABLE',
  'INTERNAL',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NO_ACTIVE_SEASON',
  'DB_UNAVAILABLE',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    retryAfter: z.number().int().nonnegative().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const DataSourceSchema = z.enum(['fresh', 'cache', 'stale']);
export type DataSource = z.infer<typeof DataSourceSchema>;

export const MetaSchema = z.object({
  source: DataSourceSchema,
  fetchedAt: IsoDate,
  ageSeconds: z.number().int().nonnegative(),
});
export type Meta = z.infer<typeof MetaSchema>;

export function envelopeSchema<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: MetaSchema });
}

export const ImageRefSchema = z.object({ id: z.number().int(), imageUrl: Url.nullable() });
export type ImageRef = z.infer<typeof ImageRefSchema>;

export const RaritySchema = z.object({ name: z.string(), color: z.string() });
export type Rarity = z.infer<typeof RaritySchema>;

export const NamedItemSchema = z.object({ id: z.number().int(), name: z.string() });
export type NamedItem = z.infer<typeof NamedItemSchema>;

export const PlayerBrawlerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  power: z.number().int(),
  rank: z.number().int(),
  trophies: z.number().int(),
  highestTrophies: z.number().int(),
  gadgets: z.array(NamedItemSchema),
  starPowers: z.array(NamedItemSchema),
  gears: z.array(NamedItemSchema),
  imageUrl: Url.nullable(),
  rarity: RaritySchema.nullable(),
  class: z.string().nullable(),
});
export type PlayerBrawler = z.infer<typeof PlayerBrawlerSchema>;

export const PlayerSchema = z.object({
  tag: Tag,
  name: z.string(),
  nameColor: z.string().nullable(),
  icon: ImageRefSchema,
  trophies: z.number().int(),
  highestTrophies: z.number().int(),
  expLevel: z.number().int(),
  victories: z.object({
    trio: z.number().int(),
    duo: z.number().int(),
    solo: z.number().int(),
  }),
  club: z.object({ tag: Tag, name: z.string() }).nullable(),
  brawlers: z.array(PlayerBrawlerSchema),
});
export type Player = z.infer<typeof PlayerSchema>;

export const BattlePlayerSchema = z.object({
  tag: Tag,
  name: z.string(),
  brawler: z.object({
    id: z.number().int(),
    name: z.string(),
    power: z.number().int(),
    trophies: z.number().int(),
    imageUrl: Url.nullable(),
  }),
});
export type BattlePlayer = z.infer<typeof BattlePlayerSchema>;

export const BattleSchema = z.object({
  battleTime: IsoDate,
  mode: z.string(),
  type: z.string().nullable(),
  map: z.object({
    id: z.number().int().nullable(),
    name: z.string().nullable(),
    imageUrl: Url.nullable(),
  }),
  result: z.enum(['victory', 'defeat', 'draw']).nullable(),
  rank: z.number().int().nullable(),
  trophyChange: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  starPlayerTag: Tag.nullable(),
  teams: z.array(z.array(BattlePlayerSchema)),
});
export type Battle = z.infer<typeof BattleSchema>;

export const ClubMemberSchema = z.object({
  tag: Tag,
  name: z.string(),
  nameColor: z.string().nullable(),
  role: z.string(),
  trophies: z.number().int(),
  icon: ImageRefSchema,
});
export type ClubMember = z.infer<typeof ClubMemberSchema>;

export const ClubSchema = z.object({
  tag: Tag,
  name: z.string(),
  description: z.string(),
  type: z.string(),
  badgeId: z.number().int(),
  badgeImageUrl: Url.nullable(),
  requiredTrophies: z.number().int(),
  trophies: z.number().int(),
  members: z.array(ClubMemberSchema),
});
export type Club = z.infer<typeof ClubSchema>;

export const BrawlerSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  imageUrl: Url.nullable(),
  rarity: RaritySchema.nullable(),
  class: z.string().nullable(),
  gadgets: z.array(NamedItemSchema),
  starPowers: z.array(NamedItemSchema),
});
export type Brawler = z.infer<typeof BrawlerSchema>;

export const EventSlotSchema = z.object({
  slotId: z.number().int(),
  startTime: IsoDate,
  endTime: IsoDate,
  mode: z.object({ name: z.string(), imageUrl: Url.nullable() }),
  map: z.object({
    id: z.number().int().nullable(),
    name: z.string().nullable(),
    imageUrl: Url.nullable(),
  }),
});
export type EventSlot = z.infer<typeof EventSlotSchema>;

export const PlayerRankingSchema = z.object({
  rank: z.number().int(),
  tag: Tag,
  name: z.string(),
  nameColor: z.string().nullable(),
  trophies: z.number().int(),
  icon: ImageRefSchema,
  clubName: z.string().nullable(),
});
export type PlayerRanking = z.infer<typeof PlayerRankingSchema>;

export const ClubRankingSchema = z.object({
  rank: z.number().int(),
  tag: Tag,
  name: z.string(),
  trophies: z.number().int(),
  badgeId: z.number().int(),
  badgeImageUrl: Url.nullable(),
  memberCount: z.number().int(),
});
export type ClubRanking = z.infer<typeof ClubRankingSchema>;

export const HealthSchema = z.object({
  status: z.literal('ok'),
  cache: z.enum(['memory', 'redis']),
  supercell: z.enum(['ok', 'cooldown', 'unauthorized', 'mock']),
  db: z.enum(['ok', 'down', 'disabled']),
});
export type Health = z.infer<typeof HealthSchema>;

export const TIER_VALUES = { S: 5, A: 4, B: 3, C: 2, D: 1 } as const;
export const TierLetterSchema = z.enum(['S', 'A', 'B', 'C', 'D']);
export type TierLetter = z.infer<typeof TierLetterSchema>;

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  playerTag: z.string().nullable(),
  isAdmin: z.boolean(),
});
export type User = z.infer<typeof UserSchema>;

export const MeSchema = z.object({ user: UserSchema.nullable() });
export type Me = z.infer<typeof MeSchema>;

export const FavoriteKindSchema = z.enum(['player', 'club']);

export const FavoriteSchema = z.object({
  kind: FavoriteKindSchema,
  tag: z.string(),
  name: z.string(),
  createdAt: z.string(),
});
export type Favorite = z.infer<typeof FavoriteSchema>;

export const SeasonSchema = z.object({
  id: z.number(),
  name: z.string(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type Season = z.infer<typeof SeasonSchema>;

export const TierRowSchema = z.object({
  brawlerId: z.number(),
  tier: TierLetterSchema.nullable(),
  average: z.number(),
  votes: z.number(),
});
export type TierRow = z.infer<typeof TierRowSchema>;

export const CommunityTierListSchema = z.object({
  season: SeasonSchema,
  voters: z.number(),
  rows: z.array(TierRowSchema),
});
export type CommunityTierList = z.infer<typeof CommunityTierListSchema>;

export const MyTierListSchema = z.object({
  season: SeasonSchema,
  votes: z.array(
    z.object({ brawlerId: z.number(), tier: z.number().int().min(1).max(5) }),
  ),
});
export type MyTierList = z.infer<typeof MyTierListSchema>;

export const SaveTierListBodySchema = z
  .object({
    votes: z
      .array(
        z.object({
          brawlerId: z.number().int().positive(),
          tier: z.number().int().min(1).max(5),
        }),
      )
      .max(200),
  })
  .superRefine((body, ctx) => {
    const seen = new Set<number>();
    for (const [i, v] of body.votes.entries()) {
      if (seen.has(v.brawlerId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'brawlerId repetido',
          path: ['votes', i, 'brawlerId'],
        });
      }
      seen.add(v.brawlerId);
    }
  });
export type SaveTierListBody = z.infer<typeof SaveTierListBodySchema>;

export const ImportFavoritesBodySchema = z.object({
  items: z
    .array(z.object({ kind: FavoriteKindSchema, tag: z.string(), name: z.string() }))
    .max(100),
});
export type ImportFavoritesBody = z.infer<typeof ImportFavoritesBodySchema>;
