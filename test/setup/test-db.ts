import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/shared/infrastructure/database/postgres/schema';

export type TestDb = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | undefined;

/**
 * Returns a Drizzle handle on the container database provisioned by globalSetup.
 *
 * The connection is memoised per worker, so callers may call this in every test
 * without opening a new pool each time. Always pair with `closeTestDb()` in
 * `afterAll`, or Jest hangs on the open handle.
 *
 * @throws Error when run outside the `integration` project, where no container
 *   has been provisioned
 */
export function testDb(): TestDb {
  const uri = process.env.TEST_POSTGRES_URI;
  if (!uri) {
    throw new Error(
      'TEST_POSTGRES_URI is not set. Run this suite through the "integration" jest project so globalSetup provisions a container.',
    );
  }

  client ??= postgres(uri, { max: 5 });
  return drizzle(client, { schema });
}

/** Empties every table so each test starts from a known state. */
export async function truncateAll(db: TestDb): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
}

/** Closes the memoised connection. Required in `afterAll`. */
export async function closeTestDb(): Promise<void> {
  await client?.end();
  client = undefined;
}
