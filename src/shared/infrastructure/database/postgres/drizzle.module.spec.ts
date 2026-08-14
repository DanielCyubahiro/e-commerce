import { Test } from '@nestjs/testing';
import { DrizzleModule } from './drizzle.module';
import {
  DRIZZLE,
  POSTGRES_CLIENT,
  type PostgresClient,
} from './drizzle.provider';

describe('DrizzleModule', () => {
  it('ends the connection pool on shutdown', async () => {
    const end = jest.fn(() => Promise.resolve());
    const client = { end } as unknown as PostgresClient;

    const moduleRef = await Test.createTestingModule({
      imports: [DrizzleModule],
    })
      .overrideProvider(POSTGRES_CLIENT)
      .useValue(client)
      .overrideProvider(DRIZZLE)
      .useValue({})
      .compile();

    await moduleRef.init();
    expect(end).not.toHaveBeenCalled();

    await moduleRef.close();
    expect(end).toHaveBeenCalledTimes(1);
  });
});
