import {
  text,
  varchar,
  uuid,
  integer,
  boolean,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  priceAmount: integer('price_amount').notNull(),
  priceCurrency: varchar('price_currency', { length: 3 })
    .notNull()
    .default('EUR'),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  stock: integer('stock').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
