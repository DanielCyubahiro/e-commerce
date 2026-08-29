import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const credentials = pgTable('credentials', {
  // The primary key is also the foreign key: a credential's identity is its
  // user's identity, so there is no second id that could fall out of step.
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // An argon2id PHC string runs about 97 characters at the parameters in use.
  // 255 leaves room to raise the cost without a migration.
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  // NULL is the only spelling of unverified.
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  // No updated_at here, and therefore no trigger, unlike users: nothing reads a
  // mutation timestamp for a credential. Stated because a missing trigger
  // otherwise reads as a fork hazard.
});
