import { ConfigService } from '@nestjs/config';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

export const DrizzleProvider = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): DrizzleDB => {
    const connectionString =
      configService.getOrThrow<string>('POSTGRES_DB_URI');
    const client = postgres(connectionString);
    return drizzle(client, { schema });
  },
};
