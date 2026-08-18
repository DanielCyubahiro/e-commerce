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
});
