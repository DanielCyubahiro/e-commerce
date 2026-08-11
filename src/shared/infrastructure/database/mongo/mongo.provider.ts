import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';

export const MONGO = Symbol('MONGO');

export const MongoProvider = {
  provide: MONGO,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const mongoUri = configService.getOrThrow<string>('MONGO_DB_URI');
    const mongoDbName = configService.get<string>('MONGO_DB_NAME', 'ecommerce');

    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(mongoDbName);

    return db;
  },
};
