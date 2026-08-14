import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export interface ContainerHolder {
  __POSTGRES_CONTAINER__?: StartedPostgreSqlContainer;
}

export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:18')
    .withDatabase('ecommerce_test')
    .start();

  const uri = container.getConnectionUri();
  process.env.TEST_POSTGRES_URI = uri;
  (globalThis as ContainerHolder).__POSTGRES_CONTAINER__ = container;

  const client = postgres(uri, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  } finally {
    await client.end();
  }
}
