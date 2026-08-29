import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// Must stay equal to OrderStatus's list in src/ordering/domain. Two copies,
// nothing enforcing agreement: a sixth status added in TypeScript alone
// compiles and fails at insert time. Not imported from the context on purpose,
// the shared kernel must not depend on a bounded context.
export const orderStatus = pgEnum('order_status', [
  'placed',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
]);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey(),
    // Store-assigned and never on the aggregate: the domain mints `id`, the
    // database assigns `number` at insert, the same ownership split as
    // updated_at. Sequential, so it leaks order volume; accepted.
    number: bigint('number', { mode: 'number' })
      .unique()
      .generatedAlwaysAsIdentity(),
    // No foreign key: cross-context references are by id, and an order must
    // outlive the account that placed it.
    customerId: uuid('customer_id').notNull(),
    status: orderStatus('status').notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    // Minor units, written once at placement. See Money.
    subtotalAmount: integer('subtotal_amount').notNull(),
    shippingFeeAmount: integer('shipping_fee_amount').notNull(),
    taxAmount: integer('tax_amount').notNull(),
    totalAmount: integer('total_amount').notNull(),
    // Lengths must stay equal to ShippingAddress's ceilings. varchar, never
    // char: char blank-pads, which makes equality depend on the padding.
    shipRecipientName: varchar('ship_recipient_name', {
      length: 200,
    }).notNull(),
    shipLine1: varchar('ship_line1', { length: 200 }).notNull(),
    shipLine2: varchar('ship_line2', { length: 200 }),
    shipCity: varchar('ship_city', { length: 100 }).notNull(),
    shipRegion: varchar('ship_region', { length: 100 }),
    shipPostalCode: varchar('ship_postal_code', { length: 20 }).notNull(),
    shipCountry: varchar('ship_country', { length: 2 }).notNull(),
    idempotencyKey: uuid('idempotency_key'),
    // Optimistic lock: save matches on the version it loaded and increments it.
    version: integer('version').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // The orders_set_updated_at trigger owns this on update.
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Nulls are distinct, so keyless orders never collide. The write adapter
    // matches this exact name on a 23505 for its 'duplicate-key' outcome.
    uniqueIndex('orders_customer_id_idempotency_key_unique').on(
      table.customerId,
      table.idempotencyKey,
    ),
    // Serves the customer's own list; matches its ORDER BY exactly.
    index('orders_customer_id_created_at_id_idx').on(
      table.customerId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    // Serves the staff list.
    index('orders_created_at_id_idx').on(
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);
