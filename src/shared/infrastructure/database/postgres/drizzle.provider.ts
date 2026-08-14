import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');
export const DRIZZLE = Symbol('DRIZZLE');

export type PostgresClient = ReturnType<typeof postgres>;
export type DrizzleDB = PostgresJsDatabase<typeof schema>;

/**
 * Provided separately from the Drizzle handle so that something owns the pool
 * and can close it. A single factory returning only the handle leaves no
 * reference capable of ending the connection, which keeps the process alive.
 */
export const PostgresClientProvider = {
  provide: POSTGRES_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): PostgresClient =>
    postgres(configService.getOrThrow<string>('POSTGRES_DB_URI')),
};

export const DrizzleProvider = {
  provide: DRIZZLE,
  inject: [POSTGRES_CLIENT],
  useFactory: (client: PostgresClient): DrizzleDB =>
    drizzle(client, { schema }),
};
