import { sql } from 'drizzle-orm';
import { closeTestDb, testDb } from './test-db';

describe('migrated test database', () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it('is a throwaway container, never the development database', async () => {
    const rows = await testDb().execute<{ current_database: string }>(
      sql`SELECT current_database()`,
    );

    expect(rows[0]?.current_database).toBe('ecommerce_test');
    expect(process.env.TEST_POSTGRES_URI).not.toContain(':5432/');
  });

  it('has a products table with every migrated column', async () => {
    const rows = await testDb().execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY column_name
    `);

    expect(rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'description',
      'id',
      'name',
      'price_amount',
      'price_currency',
      'sku',
      'stock',
      'updated_at',
    ]);
  });

  it('bounds sku to the length the domain enforces', async () => {
    const rows = await testDb().execute<{
      character_maximum_length: number;
    }>(sql`
      SELECT character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'sku'
    `);

    expect(rows[0]?.character_maximum_length).toBe(50);
  });

  it('indexes the columns the filter and the sort order use', async () => {
    const rows = await testDb().execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'products'
      ORDER BY indexname
    `);

    expect(rows.map((row) => row.indexname)).toEqual([
      'products_created_at_id_idx',
      'products_pkey',
      'products_price_amount_idx',
      'products_sku_unique',
    ]);
  });

  it('carries the trigger that owns updated_at', async () => {
    const rows = await testDb().execute<{ tgname: string }>(sql`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'products'::regclass AND NOT tgisinternal
      ORDER BY tgname
    `);

    expect(rows.map((row) => row.tgname)).toEqual(['products_set_updated_at']);
  });

  it('moves updated_at on an update, from the database clock', async () => {
    // Both timestamps have to come from one clock for this comparison to mean
    // anything, which is the whole point of ADR 0009.
    const db = testDb();
    await db.execute(sql`
      INSERT INTO products (id, name, description, price_amount, sku)
      VALUES (gen_random_uuid(), 'Trigger Probe', 'Probes the trigger.', 1, 'TRIG-PROBE')
    `);

    await db.execute(
      sql`UPDATE products SET stock = 5 WHERE sku = 'TRIG-PROBE'`,
    );

    const rows = await db.execute<{ moved: boolean }>(sql`
      SELECT updated_at > created_at AS moved
      FROM products WHERE sku = 'TRIG-PROBE'
    `);
    await db.execute(sql`DELETE FROM products WHERE sku = 'TRIG-PROBE'`);

    expect(rows[0]?.moved).toBe(true);
  });

  it('has a users table with every migrated column', async () => {
    const rows = await testDb().execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY column_name
    `);

    expect(rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'email',
      'first_name',
      'id',
      'last_name',
      'phone',
      'role',
      'updated_at',
    ]);
  });

  it('bounds email to the length the domain enforces', async () => {
    const rows = await testDb().execute<{
      character_maximum_length: number;
    }>(sql`
      SELECT character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'email'
    `);

    expect(rows[0]?.character_maximum_length).toBe(254);
  });

  it('indexes only what the sort order and uniqueness need', async () => {
    const rows = await testDb().execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'users'
      ORDER BY indexname
    `);

    // No role index on purpose: two distinct values means a filter matching
    // about half the table, which Postgres answers with a sequential scan.
    expect(rows.map((row) => row.indexname)).toEqual([
      'users_created_at_id_idx',
      'users_email_unique',
      'users_pkey',
    ]);
  });

  it('carries the trigger that owns users.updated_at', async () => {
    const rows = await testDb().execute<{ tgname: string }>(sql`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'users'::regclass AND NOT tgisinternal
      ORDER BY tgname
    `);

    expect(rows.map((row) => row.tgname)).toEqual(['users_set_updated_at']);
  });

  it('rejects a role outside the enum', async () => {
    // The adapter can never send this, UserRole would have rejected it first.
    // The column is what makes a writer that bypasses the domain fail.
    const db = testDb();

    await expect(
      db.execute(sql`
        INSERT INTO users (id, first_name, last_name, email, role)
        VALUES (gen_random_uuid(), 'Ada', 'Lovelace', 'enum-probe@example.com', 'admin')
      `),
    ).rejects.toThrow();
  });

  it('moves users.updated_at on an update, from the database clock', async () => {
    const db = testDb();

    await db.execute(sql`
      INSERT INTO users (id, first_name, last_name, email, role)
      VALUES (gen_random_uuid(), 'Trigger', 'Probe', 'trigger-probe@example.com', 'customer')
    `);
    await db.execute(sql`
      UPDATE users SET last_name = 'Probed' WHERE email = 'trigger-probe@example.com'
    `);

    const rows = await db.execute<{ moved: boolean }>(sql`
      SELECT updated_at > created_at AS moved
      FROM users WHERE email = 'trigger-probe@example.com'
    `);
    await db.execute(
      sql`DELETE FROM users WHERE email = 'trigger-probe@example.com'`,
    );

    expect(rows[0]?.moved).toBe(true);
  });

  it('has a credentials table with every migrated column', async () => {
    const rows = await testDb().execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'credentials'
      ORDER BY column_name
    `);

    expect(rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'email_verified_at',
      'password_hash',
      'user_id',
    ]);
  });

  it('has a refresh_tokens table with every migrated column', async () => {
    const rows = await testDb().execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'refresh_tokens'
      ORDER BY column_name
    `);

    expect(rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'expires_at',
      'id',
      'revoked_at',
      'session_id',
      'token_hash',
      'used_at',
      'user_id',
    ]);
  });

  it('has a one_time_tokens table with every migrated column', async () => {
    const rows = await testDb().execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'one_time_tokens'
      ORDER BY column_name
    `);

    expect(rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'expires_at',
      'id',
      'purpose',
      'token_hash',
      'used_at',
      'user_id',
    ]);
  });

  it('stores auth timestamps with a timezone, unlike users and products', async () => {
    const rows = await testDb().execute<{
      table_name: string;
      data_type: string;
    }>(sql`
      SELECT table_name, data_type
      FROM information_schema.columns
      WHERE column_name = 'expires_at'
      ORDER BY table_name
    `);

    expect(rows).toEqual([
      { table_name: 'one_time_tokens', data_type: 'timestamp with time zone' },
      { table_name: 'refresh_tokens', data_type: 'timestamp with time zone' },
    ]);
  });

  it('cascades every auth table when its user row is deleted', async () => {
    // confdeltype 'c' is ON DELETE CASCADE. Asserted rather than assumed
    // because a live refresh token outliving its user is the one orphan that
    // would still authenticate.
    const rows = await testDb().execute<{
      conrelid: string;
      confdeltype: string;
    }>(sql`
      SELECT conrelid::regclass::text AS conrelid, confdeltype
      FROM pg_constraint
      WHERE contype = 'f'
        AND confrelid = 'users'::regclass
      ORDER BY conrelid
    `);

    expect(rows).toEqual([
      { conrelid: 'credentials', confdeltype: 'c' },
      { conrelid: 'one_time_tokens', confdeltype: 'c' },
      { conrelid: 'refresh_tokens', confdeltype: 'c' },
    ]);
  });

  it('indexes what chain revocation, logout-all and the cascades need', async () => {
    const rows = await testDb().execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('credentials', 'refresh_tokens', 'one_time_tokens')
      ORDER BY indexname
    `);

    expect(rows.map((row) => row.indexname)).toEqual([
      'credentials_pkey',
      'one_time_tokens_pkey',
      'one_time_tokens_token_hash_unique',
      'one_time_tokens_user_id_purpose_idx',
      'refresh_tokens_pkey',
      'refresh_tokens_session_id_idx',
      'refresh_tokens_token_hash_unique',
      'refresh_tokens_user_id_idx',
    ]);
  });

  it('carries no trigger on credentials, deliberately', async () => {
    // credentials has no updated_at, so it needs no trigger. Asserted so the
    // absence reads as a decision rather than the fork hazard in ADR 0009.
    const rows = await testDb().execute<{ tgname: string }>(sql`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'credentials'::regclass AND NOT tgisinternal
    `);

    expect(rows).toEqual([]);
  });

  const insertProbeOrder = async (
    status: string,
    customerId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  ): Promise<string> => {
    const rows = await testDb().execute<{ id: string }>(sql`
      INSERT INTO orders (
        id, customer_id, status, currency,
        subtotal_amount, shipping_fee_amount, tax_amount, total_amount,
        ship_recipient_name, ship_line1, ship_city, ship_postal_code, ship_country,
        version
      ) VALUES (
        gen_random_uuid(), ${customerId}, ${status}::order_status, 'EUR',
        100, 0, 0, 100,
        'Ada Lovelace', '1 Analytical Way', 'London', 'N1 1AA', 'GB',
        1
      ) RETURNING id
    `);
    return rows[0]?.id ?? '';
  };

  it('has an orders table with every migrated column', async () => {
    const rows = await testDb().execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY column_name COLLATE "C"
    `);

    expect(rows.map((row) => row.column_name)).toEqual([
      'cancelled_at',
      'created_at',
      'currency',
      'customer_id',
      'delivered_at',
      'id',
      'idempotency_key',
      'number',
      'paid_at',
      'ship_city',
      'ship_country',
      'ship_line1',
      'ship_line2',
      'ship_postal_code',
      'ship_recipient_name',
      'ship_region',
      'shipped_at',
      'shipping_fee_amount',
      'status',
      'subtotal_amount',
      'tax_amount',
      'total_amount',
      'updated_at',
      'version',
    ]);
  });

  it('assigns orders.number from an identity column the application never writes', async () => {
    const rows = await testDb().execute<{
      is_identity: string;
      identity_generation: string;
    }>(sql`
      SELECT is_identity, identity_generation
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'number'
    `);

    expect(rows[0]).toEqual({
      is_identity: 'YES',
      identity_generation: 'ALWAYS',
    });
  });

  it('has an order_lines table with every migrated column', async () => {
    const rows = await testDb().execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'order_lines'
      ORDER BY column_name COLLATE "C"
    `);

    expect(rows.map((row) => row.column_name)).toEqual([
      'line_total_amount',
      'name',
      'order_id',
      'product_id',
      'quantity',
      'sku',
      'unit_price_amount',
    ]);
  });

  it('keys order_lines on (order_id, product_id) and cascades from orders', async () => {
    const rows = await testDb().execute<{
      conname: string;
      contype: string;
      confdeltype: string;
    }>(sql`
      SELECT conname, contype, confdeltype
      FROM pg_constraint
      -- Postgres 17+ also catalogues every NOT NULL as its own contype 'n'
      -- row; excluded here since this case is about the fk, pk, and check.
      WHERE conrelid = 'order_lines'::regclass AND contype != 'n'
      ORDER BY conname COLLATE "C"
    `);

    expect(rows).toEqual([
      {
        conname: 'order_lines_order_id_orders_id_fk',
        contype: 'f',
        confdeltype: 'c',
      },
      {
        conname: 'order_lines_order_id_product_id_pk',
        contype: 'p',
        confdeltype: ' ',
      },
      {
        conname: 'order_lines_quantity_positive',
        contype: 'c',
        confdeltype: ' ',
      },
    ]);
  });

  it('indexes the customer list, the staff list, the idempotency key, and the number', async () => {
    const rows = await testDb().execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'orders'
      ORDER BY indexname COLLATE "C"
    `);

    expect(rows.map((row) => row.indexname)).toEqual([
      'orders_created_at_id_idx',
      'orders_customer_id_created_at_id_idx',
      'orders_customer_id_idempotency_key_unique',
      'orders_number_unique',
      'orders_pkey',
    ]);
  });

  it('lets two keyless orders coexist but not two with the same customer and key', async () => {
    const db = testDb();
    const key = '9c858901-8a57-4791-81fe-4c455b099bc9';
    await insertProbeOrder('placed');
    await insertProbeOrder('placed');
    await db.execute(sql`
      UPDATE orders SET idempotency_key = ${key}
      WHERE id = (SELECT id FROM orders ORDER BY number LIMIT 1)
    `);

    await expect(
      db.execute(sql`
        UPDATE orders SET idempotency_key = ${key}
        WHERE id = (SELECT id FROM orders ORDER BY number DESC LIMIT 1)
      `),
    ).rejects.toThrow();

    await db.execute(sql`DELETE FROM orders`);
  });

  it('rejects a status outside the enum', async () => {
    await expect(insertProbeOrder('refunded')).rejects.toThrow();
  });

  it('rejects a non-positive line quantity at the database', async () => {
    const db = testDb();
    const orderId = await insertProbeOrder('placed');

    await expect(
      db.execute(sql`
        INSERT INTO order_lines (order_id, product_id, sku, name, unit_price_amount, quantity, line_total_amount)
        VALUES (${orderId}, gen_random_uuid(), 'SKU-1', 'Probe', 100, 0, 0)
      `),
    ).rejects.toThrow();

    await db.execute(sql`DELETE FROM orders WHERE id = ${orderId}`);
  });

  it('rejects negative stock at the database', async () => {
    const db = testDb();
    await db.execute(sql`
      INSERT INTO products (id, name, description, price_amount, sku, stock)
      VALUES (gen_random_uuid(), 'Check Probe', 'Probes the check.', 1, 'CHECK-PROBE', 1)
    `);

    await expect(
      db.execute(sql`UPDATE products SET stock = -1 WHERE sku = 'CHECK-PROBE'`),
    ).rejects.toThrow();

    await db.execute(sql`DELETE FROM products WHERE sku = 'CHECK-PROBE'`);
  });

  it('names both check constraints so the fork notes can point at them', async () => {
    const rows = await testDb().execute<{ conname: string }>(sql`
      SELECT conname FROM pg_constraint
      WHERE contype = 'c'
        AND conrelid IN ('order_lines'::regclass, 'products'::regclass)
      ORDER BY conname COLLATE "C"
    `);

    expect(rows.map((row) => row.conname)).toEqual([
      'order_lines_quantity_positive',
      'products_stock_non_negative',
    ]);
  });

  it('carries the trigger that owns orders.updated_at', async () => {
    const rows = await testDb().execute<{ tgname: string }>(sql`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'orders'::regclass AND NOT tgisinternal
    `);

    expect(rows.map((row) => row.tgname)).toEqual(['orders_set_updated_at']);
  });

  it('moves orders.updated_at on an update, from the database clock', async () => {
    const db = testDb();
    const orderId = await insertProbeOrder('placed');

    await db.execute(
      sql`UPDATE orders SET status = 'paid' WHERE id = ${orderId}`,
    );

    const rows = await db.execute<{ moved: boolean }>(sql`
      SELECT updated_at > created_at AS moved FROM orders WHERE id = ${orderId}
    `);
    await db.execute(sql`DELETE FROM orders WHERE id = ${orderId}`);

    expect(rows[0]?.moved).toBe(true);
  });

  it('stores order timestamps with a timezone', async () => {
    const rows = await testDb().execute<{ data_type: string }>(sql`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'created_at'
    `);

    expect(rows[0]?.data_type).toBe('timestamp with time zone');
  });
});
