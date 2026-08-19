import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Must stay equal to UserRole's ROLES. Two copies, nothing enforcing
// agreement: a third role added in TypeScript alone compiles and fails at
// insert time. Not imported from @/user/domain on purpose, that would make the
// shared kernel depend on a bounded context.
export const userRole = pgEnum('user_role', ['customer', 'seller']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    // Must stay equal to User.MAX_NAME_LENGTH.
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    // Must stay equal to Email.MAX_LENGTH.
    email: varchar('email', { length: 254 }).notNull().unique(),
    role: userRole('role').notNull(),
    // '+' plus up to 15 digits, the bound Phone.vo enforces (not E.164: no
    // country-code or trunk-prefix check). NULL is the only spelling of
    // absence; see ADR 0011.
    phone: varchar('phone', { length: 16 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // The users_set_updated_at trigger owns this on update, so both timestamps
    // come from the database clock. See ADR 0009.
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    // Matches DrizzleUserReadRepository.findMany's ORDER BY exactly. Both the
    // column order and the descending direction matter; reverse either and the
    // sort stops using it.
    index('users_created_at_id_idx').on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);
