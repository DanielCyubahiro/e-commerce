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
});
