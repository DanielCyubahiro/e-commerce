import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey(),
    // Groups every token in one login's rotation chain. Deliberately not a
    // foreign key: there is no sessions table, and the chain needs no row of
    // its own to be revocable.
    sessionId: uuid('session_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // SHA-256 hex, lowercase. Must stay equal to TokenHash.LENGTH. varchar and
    // not char: char blank-pads to its length, which makes equality depend on
    // the padding.
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Set by a normal rotation. A token presented after this is set is the
    // replay signal that revokes the whole chain.
    usedAt: timestamp('used_at', { withTimezone: true }),
    // Set by chain revocation. Distinct from usedAt on purpose: both make a
    // token unusable, and they produce different verdicts.
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('refresh_tokens_session_id_idx').on(table.sessionId),
    // Serves logout-all and the ON DELETE CASCADE, which scans the table
    // without it: Postgres does not index foreign key columns automatically.
    index('refresh_tokens_user_id_idx').on(table.userId),
  ],
);
