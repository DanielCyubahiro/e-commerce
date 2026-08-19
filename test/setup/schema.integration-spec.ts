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
});
