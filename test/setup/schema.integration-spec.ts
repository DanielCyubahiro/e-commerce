import { sql } from 'drizzle-orm';
import { closeTestDb, testDb } from './test-db';

describe('migrated test database', () => {
  afterAll(async () => {
    await closeTestDb();
  });

  it('is a throwaway container, never the development database', async () => {
    // truncateAll() runs against whatever this resolves to, so being wrong here
    // would destroy development data rather than fail a test.
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
      'is_active',
      'low_stock_threshold',
      'name',
      'price_amount',
      'price_currency',
      'sku',
      'stock',
      'updated_at',
    ]);
  });
});
