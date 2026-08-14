import type { ConfigService } from '@nestjs/config';
import { DrizzleProvider, PostgresClientProvider } from './drizzle.provider';

const configService = {
  getOrThrow: () => 'postgresql://postgres:postgres@localhost:5432/nowhere',
} as unknown as ConfigService;

describe('postgres providers', () => {
  it('builds a pool from the configured uri without connecting', async () => {
    // postgres.js connects lazily, on first query, so constructing one performs
    // no I/O and this needs no database.
    const client = PostgresClientProvider.useFactory(configService);

    expect(typeof client.end).toBe('function');

    await client.end();
  });

  it('wraps the pool in a drizzle handle', async () => {
    const client = PostgresClientProvider.useFactory(configService);

    expect(DrizzleProvider.useFactory(client)).toHaveProperty('select');

    await client.end();
  });
});
