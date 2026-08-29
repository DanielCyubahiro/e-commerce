import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    // Minor units, never a decimal. See Money.
    priceAmount: integer('price_amount').notNull(),
    priceCurrency: varchar('price_currency', { length: 3 })
      .notNull()
      .default('EUR'),
    // Must stay equal to Sku.MAX_LENGTH. Three copies, nothing enforcing
    // agreement.
    sku: varchar('sku', { length: 50 }).notNull().unique(),
    stock: integer('stock').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // The products_set_updated_at trigger owns this on update, so both
    // timestamps come from the database clock; a `$onUpdate` hook here would
    // write the host process clock instead.
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    // Serves the price filters in DrizzleProductReadRepository.findMany.
    index('products_price_amount_idx').on(table.priceAmount),
    // Matches DrizzleProductReadRepository.findMany's ORDER BY exactly. Both
    // the column order and the descending direction matter; reverse either
    // and the sort stops using it.
    index('products_created_at_id_idx').on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
    // The StockAllocator's `stock >= $qty` guard is the mechanism; this is the
    // backstop that makes negative stock unrepresentable even for a writer that
    // bypasses the port.
    check('products_stock_non_negative', sql`${table.stock} >= 0`),
  ],
);
