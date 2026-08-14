import { ConfigService } from '@nestjs/config';
import { type Db, MongoClient } from 'mongodb';

export const MONGO_CLIENT = Symbol('MONGO_CLIENT');
export const MONGO_DB = Symbol('MONGO_DB');

export const MongoClientProvider = {
  provide: MONGO_CLIENT,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<MongoClient> => {
    const client = new MongoClient(
      configService.getOrThrow<string>('MONGO_DB_URI'),
    );
    await client.connect();
    return client;
  },
};

export const MongoDbProvider = {
  provide: MONGO_DB,
  inject: [MONGO_CLIENT, ConfigService],
  useFactory: (client: MongoClient, configService: ConfigService): Db =>
    client.db(configService.getOrThrow<string>('MONGO_DB_NAME')),
};
