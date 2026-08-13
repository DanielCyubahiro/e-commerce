import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Shape of the handle this file parks for the teardown file to collect. */
export interface ContainerHolder {
  __POSTGRES_CONTAINER__?: StartedPostgreSqlContainer;
}

/**
 * Starts one throwaway Postgres for the whole integration run and applies every
 * drizzle migration to it.
 *
 * The connection string reaches test workers through `process.env`, which they
 * inherit from this process. The container handle goes on `globalThis` because
 * the teardown file runs in this same process but is a separate module.
 *
 * Applying the migrations here means every integration run also proves the
 * migration folder still applies cleanly from an empty database.
 */
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
