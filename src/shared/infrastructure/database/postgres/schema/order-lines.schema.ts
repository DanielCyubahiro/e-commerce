import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgTable,
  primaryKey,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { orders } from './orders.schema';

export const orderLines = pgTable(
  'order_lines',
  {
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    // No foreign key: the line is a snapshot of what was sold and must survive
    // the product's deletion. See ADR 0007's revisit.
    productId: uuid('product_id').notNull(),
    // Must stay equal to products.sku and Sku.MAX_LENGTH.
    sku: varchar('sku', { length: 50 }).notNull(),
    // Must stay equal to products.name.
    name: varchar('name', { length: 255 }).notNull(),
    // Minor units in the order's currency, which lives on orders.currency.
    unitPriceAmount: integer('unit_price_amount').notNull(),
    quantity: integer('quantity').notNull(),
    // Written once by the aggregate, never recomputed on read.
    lineTotalAmount: integer('line_total_amount').notNull(),
  },
  (table) => [
    // "No product twice on one order" is database-arbitrated, ADR 0003's stance.
    primaryKey({ columns: [table.orderId, table.productId] }),
    // Quantity's domain minimum is 1; this is the backstop for a writer that
    // bypasses the domain.
    check('order_lines_quantity_positive', sql`${table.quantity} > 0`),
  ],
);
