import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  datetime,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  tinyint,
  varchar,
} from 'drizzle-orm/mysql-core';

const now = () => datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`);

export const users = mysqlTable('users', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  discordId: varchar('discord_id', { length: 32 }).notNull().unique(),
  username: varchar('username', { length: 64 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 255 }),
  playerTag: varchar('player_tag', { length: 16 }),
  createdAt: now(),
});

const userRef = () =>
  bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' });

export const sessions = mysqlTable('sessions', {
  id: char('id', { length: 64 }).primaryKey(),
  userId: userRef(),
  expiresAt: datetime('expires_at').notNull(),
  createdAt: now(),
});

export const favorites = mysqlTable(
  'favorites',
  {
    userId: userRef(),
    kind: mysqlEnum('kind', ['player', 'club']).notNull(),
    tag: varchar('tag', { length: 16 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    createdAt: now(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.tag] })],
);

export const seasons = mysqlTable('seasons', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  startedAt: datetime('started_at').notNull(),
  endedAt: datetime('ended_at'),
});

export const tierVotes = mysqlTable(
  'tier_votes',
  {
    seasonId: int('season_id')
      .notNull()
      .references(() => seasons.id),
    userId: userRef(),
    brawlerId: int('brawler_id').notNull(),
    tier: tinyint('tier').notNull(),
    updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.userId, t.brawlerId] })],
);
