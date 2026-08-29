import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/shared/infrastructure/database/postgres/schema';

export type TestDb = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | undefined;

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

export async function truncateAll(db: TestDb): Promise<void> {
  // Naming the auth tables explicitly rather than relying on CASCADE from
  // users, so a table that loses its foreign key later still gets cleared
  // between tests instead of leaking rows into the next one.
  await db.execute(
    sql`TRUNCATE TABLE credentials, one_time_tokens, sessions, order_lines, orders, products, users RESTART IDENTITY CASCADE`,
  );
}

export async function closeTestDb(): Promise<void> {
  await client?.end();
  client = undefined;
}
