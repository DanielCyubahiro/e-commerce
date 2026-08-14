import type { ConfigService } from '@nestjs/config';
import type { Db, MongoClient } from 'mongodb';
import { MongoDbProvider } from './mongo.provider';

describe('MongoDbProvider', () => {
  it('selects the configured database from the client', () => {
    const database = { databaseName: 'ecommerce' } as Db;
    const db = jest.fn(() => database);
    const client = { db } as unknown as MongoClient;
    const configService = {
      getOrThrow: () => 'ecommerce',
    } as unknown as ConfigService;

    expect(MongoDbProvider.useFactory(client, configService)).toBe(database);
    expect(db).toHaveBeenCalledWith('ecommerce');
  });
});
