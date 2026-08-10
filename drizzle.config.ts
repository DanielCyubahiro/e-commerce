import { defineConfig } from 'drizzle-kit';

const url = process.env.POSTGRES_DB_URI;
if (!url) {
  throw new Error('POSTGRES_DB_URI is not set');
}

export default defineConfig({
  schema: 'src/shared/infrastructure/database/postgres/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
});
