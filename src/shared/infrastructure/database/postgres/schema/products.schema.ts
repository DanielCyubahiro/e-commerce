import {
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
    priceAmount: integer('price_amount').notNull(),
    priceCurrency: varchar('price_currency', { length: 3 })
      .notNull()
      .default('EUR'),
    sku: varchar('sku', { length: 50 }).notNull().unique(),
    stock: integer('stock').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('products_price_amount_idx').on(table.priceAmount),
    index('products_created_at_id_idx').on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);
