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

  it('no longer has a refresh_tokens table', async () => {
    const rows = await testDb().execute<{ table_name: string }>(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'refresh_tokens'
    `);

    expect(rows).toEqual([]);
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

  it('has a sessions table with every migrated column', async () => {
    const rows = await testDb().execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      ORDER BY column_name
    `);

    expect(rows.map((row) => row.column_name)).toEqual([
      'created_at',
      'id',
      'ip_address',
      'last_seen_at',
      'revoked_at',
      'token_hash',
      'user_agent',
      'user_id',
    ]);
  });

  it('stores every session timestamp with a timezone', async () => {
    const rows = await testDb().execute<{
      column_name: string;
      data_type: string;
    }>(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sessions' AND data_type LIKE 'timestamp%'
      ORDER BY column_name
    `);

    expect(rows).toEqual([
      { column_name: 'created_at', data_type: 'timestamp with time zone' },
      { column_name: 'last_seen_at', data_type: 'timestamp with time zone' },
      { column_name: 'revoked_at', data_type: 'timestamp with time zone' },
    ]);
  });

  it('keeps session origin columns unbounded, since presentation caps them', async () => {
    // `text`, not `varchar(n)`: there is no column length to keep equal to
    // the ceiling `originOf` applies, so nothing can drift.
    const rows = await testDb().execute<{
      column_name: string;
      data_type: string;
    }>(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name IN ('user_agent', 'ip_address')
      ORDER BY column_name
    `);

    expect(rows).toEqual([
      { column_name: 'ip_address', data_type: 'text' },
      { column_name: 'user_agent', data_type: 'text' },
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
    ]);
  });

  it('cascades every auth table when its user row is deleted', async () => {
    // confdeltype 'c' is ON DELETE CASCADE. Asserted rather than assumed
    // because a live session outliving its user is the one orphan that
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
      { conrelid: 'sessions', confdeltype: 'c' },
    ]);
  });

  it('indexes what session revocation, logout-all and the cascades need', async () => {
    const rows = await testDb().execute<{ indexname: string }>(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('credentials', 'one_time_tokens', 'sessions')
      ORDER BY indexname
    `);

    expect(rows.map((row) => row.indexname)).toEqual([
      'credentials_pkey',
      'one_time_tokens_pkey',
      'one_time_tokens_token_hash_unique',
      'one_time_tokens_user_id_purpose_idx',
      'sessions_pkey',
      'sessions_token_hash_unique',
      'sessions_user_id_idx',
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
});
