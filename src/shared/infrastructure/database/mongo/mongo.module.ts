import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { MongoClient } from 'mongodb';
import {
  MONGO_CLIENT,
  MONGO_DB,
  MongoClientProvider,
  MongoDbProvider,
} from './mongo.provider';

@Global()
@Module({
  providers: [MongoClientProvider, MongoDbProvider],
  exports: [MONGO_DB],
})
export class MongoModule implements OnModuleDestroy {
  constructor(@Inject(MONGO_CLIENT) private readonly client: MongoClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
