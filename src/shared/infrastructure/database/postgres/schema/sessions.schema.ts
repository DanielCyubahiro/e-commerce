import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * One row per login. Liveness is not a column: it is computed from
 * `last_seen_at`, `created_at`, and the configured idle and absolute TTLs at
 * query time (see `DrizzleSessionRepository.live`), so shortening a TTL
 * applies to every existing session at its next request.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // SHA-256 hex, lowercase. Must stay equal to TokenHash.LENGTH. varchar and
    // not char: char blank-pads to its length, which makes equality depend on
    // the padding.
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    // Display data for the device list. `text`, so no column length has to be
    // kept equal to the ceiling presentation applies before the value gets
    // here.
    userAgent: text('user_agent'),
    // What Express reported. Behind a proxy that is the proxy's address until
    // `trust proxy` is configured.
    ipAddress: text('ip_address'),
    // Anchor for the absolute TTL.
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Anchor for the idle TTL. Moved by every authenticated request.
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set by logout, logout-all, revoke-by-id, change-password and
    // reset-password. Never cleared.
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    // Serves logout-all, the device list, and the ON DELETE CASCADE, which
    // scans the table without it: Postgres does not index foreign key columns
    // automatically.
    index('sessions_user_id_idx').on(table.userId),
  ],
);
