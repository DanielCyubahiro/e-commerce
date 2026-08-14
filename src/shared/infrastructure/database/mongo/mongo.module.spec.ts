import { Test } from '@nestjs/testing';
import type { MongoClient } from 'mongodb';
import { MongoModule } from './mongo.module';
import { MONGO_CLIENT, MONGO_DB } from './mongo.provider';

describe('MongoModule', () => {
  it('closes the client on shutdown', async () => {
    const close = jest.fn(() => Promise.resolve());
    const client = { close } as unknown as MongoClient;

    const moduleRef = await Test.createTestingModule({
      imports: [MongoModule],
    })
      .overrideProvider(MONGO_CLIENT)
      .useValue(client)
      .overrideProvider(MONGO_DB)
      .useValue({})
      .compile();

    await moduleRef.init();
    expect(close).not.toHaveBeenCalled();

    await moduleRef.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
