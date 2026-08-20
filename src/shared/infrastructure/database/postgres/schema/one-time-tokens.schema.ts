import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

// Must stay equal to TokenPurpose's PURPOSES. Two copies, nothing enforcing
// agreement: a third purpose added in TypeScript alone compiles and fails at
// insert time. Not imported from @/identity/domain on purpose, that would make
// the shared kernel depend on a bounded context.
export const tokenPurpose = pgEnum('token_purpose', [
  'password-reset',
  'email-verification',
]);

export const oneTimeTokens = pgTable(
  'one_time_tokens',
  {
    id: uuid('id').primaryKey(),
    purpose: tokenPurpose('purpose').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // SHA-256 hex, lowercase. Must stay equal to TokenHash.LENGTH.
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Serves the cascade and `issue`'s delete of a user's prior unused tokens
    // for one purpose.
    index('one_time_tokens_user_id_purpose_idx').on(
      table.userId,
      table.purpose,
    ),
  ],
);
