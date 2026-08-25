import { Test } from '@nestjs/testing';
import { UNIT_OF_WORK } from '@/shared/application';
import { DrizzleModule } from './drizzle.module';
import { DrizzleUnitOfWork } from './drizzle-unit-of-work';
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

  it('exports a unit of work bound to the Drizzle adapter', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DrizzleModule],
    })
      .overrideProvider(POSTGRES_CLIENT)
      .useValue({ end: () => Promise.resolve() })
      .overrideProvider(DRIZZLE)
      .useValue({})
      .compile();

    expect(moduleRef.get(UNIT_OF_WORK)).toBeInstanceOf(DrizzleUnitOfWork);

    await moduleRef.close();
  });
});
